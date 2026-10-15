import { useEffect, useRef } from 'react';
import { httpUtils } from '@/lib/auth-utils';

const API = 'https://sc-laufenburg.de/api/edit-lock.php';

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

export async function acquireEditLock(entity: string, entityId: string | number) {
  const res = await httpUtils.post(API, { action: 'acquire', entity, entity_id: String(entityId) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    if (res.status === 423 || data.locked) {
      throw new EditLockError(data.message || 'Dieser Eintrag wird gerade von einem anderen Benutzer bearbeitet.', {
        lockedBy: data.locked_by,
        expiresAt: data.expires_at,
      });
    }
    throw new Error(data.message || 'Bearbeitung konnte nicht gestartet werden.');
  }
  return { token: data.lock_token as string, lockedBy: data.locked_by as string };
}

async function lockRequest(action: 'release' | 'heartbeat', entity: string, entityId: string, token: string) {
  try {
    await httpUtils.post(API, { action, entity, entity_id: entityId, lock_token: token });
  } catch (error) {
    console.error(`Edit lock ${action} failed`, error);
  }
}

export function useEditLock(entity: string) {
  const lockRef = useRef<{ id: string; token: string } | null>(null);

  const release = async () => {
    const lock = lockRef.current;
    lockRef.current = null;
    if (lock) await lockRequest('release', entity, lock.id, lock.token);
  };

  const acquire = async (entityId: string | number) => {
    if (lockRef.current && lockRef.current.id !== String(entityId)) await release();
    const result = await acquireEditLock(entity, entityId);
    lockRef.current = { id: String(entityId), token: result.token };
    return result;
  };

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      const lock = lockRef.current;
      if (lock) void lockRequest('heartbeat', entity, lock.id, lock.token);
    }, 60_000);

    const releaseOnExit = () => {
      const lock = lockRef.current;
      if (!lock) return;
      const body = JSON.stringify({ action: 'release', entity, entity_id: lock.id, lock_token: lock.token });
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon?.(API, blob);
    };

    window.addEventListener('beforeunload', releaseOnExit);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('beforeunload', releaseOnExit);
      const lock = lockRef.current;
      lockRef.current = null;
      if (lock) void lockRequest('release', entity, lock.id, lock.token);
    };
  }, [entity]);

  return { acquire, release };
}
