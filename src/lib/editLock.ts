import { useCallback, useEffect, useRef } from 'react';
import { authToken, httpUtils } from '@/lib/auth-utils';
import { apiUrl } from '@/lib/api';
import { readJson } from '@/lib/api-errors';
import { toast } from '@/hooks/use-toast';

const API = apiUrl('edit-lock.php');
const HEARTBEAT_INTERVAL_MS = 60_000;

export interface EditLockInfo {
  lockedBy?: string;
  expiresAt?: string;
}

export class EditLockError extends Error {
  lockedBy?: string;
  expiresAt?: string;
  constructor(message: string, info: EditLockInfo = {}) {
    super(message);
    this.name = 'EditLockError';
    this.lockedBy = info.lockedBy;
    this.expiresAt = info.expiresAt;
  }
}

export class EditLockCancelledError extends Error {
  constructor() {
    super('Edit lock request was cancelled');
    this.name = 'EditLockCancelledError';
  }
}

interface AcquireResponse {
  lock_token?: string;
  locked_by?: string;
  expires_at?: string;
}

export async function acquireEditLock(entity: string, entityId: string | number) {
  const res = await httpUtils.post(API, { action: 'acquire', entity, entity_id: String(entityId) });
  const data = await readJson<AcquireResponse>(res);
  if (!res.ok || data.success === false || !data.lock_token) {
    if (res.status === 423 || data.locked) {
      throw new EditLockError(data.message || 'Dieser Eintrag wird gerade von einem anderen Benutzer bearbeitet.', {
        lockedBy: data.locked_by,
        expiresAt: data.expires_at,
      });
    }
    throw new Error(data.message || 'Bearbeitung konnte nicht gestartet werden.');
  }
  return { token: data.lock_token, lockedBy: data.locked_by ?? '' };
}

type LockRequestOutcome = 'ok' | 'lost' | 'error';

async function lockRequest(action: 'release' | 'heartbeat', entity: string, entityId: string, token: string): Promise<LockRequestOutcome> {
  try {
    const res = await httpUtils.post(API, { action, entity, entity_id: entityId, lock_token: token });
    const data = await readJson(res);
    if (res.status === 409 || data.locked === false) return 'lost';
    if (!res.ok || data.success === false) {
      console.error(`Edit lock ${action} failed`, res.status, data.message);
      return 'error';
    }
    return 'ok';
  } catch (error) {
    console.error(`Edit lock ${action} failed`, error);
    return 'error';
  }
}

function releaseWithBeacon(entity: string, entityId: string, lockToken: string) {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
  const body = JSON.stringify({
    action: 'release',
    entity,
    entity_id: entityId,
    lock_token: lockToken,
    token: authToken.get() ?? '',
  });
  navigator.sendBeacon(API, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
}

export function useEditLock(entity: string) {
  const lockRef = useRef<{ id: string; token: string } | null>(null);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const heartbeatTimerRef = useRef<number | null>(null);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const heartbeat = useCallback(async () => {
    const lock = lockRef.current;
    if (!lock) {
      stopHeartbeat();
      return;
    }
    const outcome = await lockRequest('heartbeat', entity, lock.id, lock.token);
    if (outcome === 'lost' && lockRef.current === lock) {
      lockRef.current = null;
      stopHeartbeat();
      toast({
        title: 'Bearbeitungssperre abgelaufen',
        description: 'Die Bearbeitungssperre ist abgelaufen oder wurde von einem anderen Benutzer übernommen. Bitte laden Sie den Eintrag neu, bevor Sie Änderungen speichern.',
        variant: 'destructive',
      });
    }
  }, [entity, stopHeartbeat]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatTimerRef.current = window.setInterval(() => { void heartbeat(); }, HEARTBEAT_INTERVAL_MS);
  }, [heartbeat, stopHeartbeat]);

  const release = useCallback(async (entityId?: string | number) => {
    if (entityId !== undefined && lockRef.current?.id !== String(entityId)) return;
    generationRef.current += 1;
    stopHeartbeat();
    const lock = lockRef.current;
    lockRef.current = null;
    if (lock) await lockRequest('release', entity, lock.id, lock.token);
  }, [entity, stopHeartbeat]);

  const acquire = useCallback(async (entityId: string | number) => {
    const id = String(entityId);
    if (lockRef.current && lockRef.current.id !== id) await release();
    const generation = ++generationRef.current;
    const result = await acquireEditLock(entity, id);
    if (!mountedRef.current || generation !== generationRef.current) {
      void lockRequest('release', entity, id, result.token);
      throw new EditLockCancelledError();
    }
    lockRef.current = { id, token: result.token };
    startHeartbeat();
    return result;
  }, [entity, release, startHeartbeat]);

  const isHeld = useCallback((entityId: string | number) => lockRef.current?.id === String(entityId), []);

  useEffect(() => {
    mountedRef.current = true;

    const releaseOnExit = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      const lock = lockRef.current;
      if (!lock) return;
      lockRef.current = null;
      stopHeartbeat();
      releaseWithBeacon(entity, lock.id, lock.token);
    };

    const refreshOnRestore = (event: PageTransitionEvent) => {
      if (event.persisted && lockRef.current) void heartbeat();
    };

    window.addEventListener('pagehide', releaseOnExit);
    window.addEventListener('pageshow', refreshOnRestore);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      stopHeartbeat();
      window.removeEventListener('pagehide', releaseOnExit);
      window.removeEventListener('pageshow', refreshOnRestore);
      const lock = lockRef.current;
      lockRef.current = null;
      if (lock) void lockRequest('release', entity, lock.id, lock.token);
    };
  }, [entity, heartbeat, stopHeartbeat]);

  return { acquire, release, isHeld };
}

export type EditLockHandle = Pick<ReturnType<typeof useEditLock>, 'acquire' | 'release' | 'isHeld'>;

export async function openWithLock<T>(editLock: EditLockHandle, entityId: string | number, load: () => Promise<T>): Promise<T> {
  await editLock.acquire(entityId);
  let result: T;
  try {
    result = await load();
  } catch (error) {
    void editLock.release(entityId);
    throw error;
  }
  if (!editLock.isHeld(entityId)) throw new EditLockCancelledError();
  return result;
}
