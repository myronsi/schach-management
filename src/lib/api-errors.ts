import { httpUtils } from '@/lib/auth-utils';
import { conflictDescription, isConflictError } from '@/lib/conflict';

export interface ApiResponseBody {
  success?: boolean;
  message?: string;
  error?: string;
  code?: string;
  conflict?: boolean;
  locked?: boolean;
  locked_by?: string;
  id?: number | string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  conflict: boolean;
  locked: boolean;
  lockedBy?: string;
  serverMessage?: string;

  constructor(message: string, status: number, body: ApiResponseBody = {}) {
    super(message);
    this.status = status;
    this.code = typeof body.code === 'string' ? body.code : undefined;
    this.conflict = body.conflict === true;
    this.locked = status === 423 || body.locked === true;
    this.lockedBy = typeof body.locked_by === 'string' ? body.locked_by : undefined;
    this.serverMessage = body.message || body.error || undefined;
    this.name = this.conflict ? 'ConflictError' : this.locked ? 'LockedError' : 'ApiError';
  }
}

export async function readJson<T extends object = ApiResponseBody>(res: Response): Promise<T & ApiResponseBody> {
  try {
    const data: unknown = await res.json();
    return (data && typeof data === 'object' ? data : {}) as T & ApiResponseBody;
  } catch {
    return {} as T & ApiResponseBody;
  }
}

export function toApiError(res: Response, body: ApiResponseBody, fallbackMessage = 'Anfrage fehlgeschlagen'): ApiError {
  const message = body.message || body.error || fallbackMessage;
  return new ApiError(message, res.status, body);
}

export async function parseApiResponse<T extends object = ApiResponseBody>(res: Response, fallbackMessage?: string): Promise<T & ApiResponseBody> {
  const body = await readJson<T>(res);
  if (!res.ok || body.success === false) {
    throw toApiError(res, body, fallbackMessage);
  }
  return body;
}

export async function postJson<T extends object = ApiResponseBody>(url: string, payload: unknown, fallbackMessage = 'Speichern fehlgeschlagen'): Promise<T & ApiResponseBody> {
  const res = await httpUtils.post(url, payload);
  return parseApiResponse<T>(res, fallbackMessage);
}

export async function deleteJson<T extends object = ApiResponseBody>(url: string, payload: unknown, fallbackMessage = 'Löschen fehlgeschlagen'): Promise<T & ApiResponseBody> {
  const res = await httpUtils.delete(url, payload);
  return parseApiResponse<T>(res, fallbackMessage);
}

export function isLockedError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.locked;
}

export const LOCKED_TITLE = 'Gesperrt';

export function describeApiError(error: unknown, fallback: string): { title: string; description: string } {
  if (isLockedError(error)) {
    const description = error.serverMessage
      || `Dieser Eintrag wird gerade${error.lockedBy ? ` von ${error.lockedBy}` : ' von einem anderen Benutzer'} bearbeitet.`;
    return { title: LOCKED_TITLE, description };
  }
  if (isConflictError(error)) {
    const description = error instanceof ApiError
      ? (error.serverMessage || conflictDescription(null))
      : conflictDescription(error);
    return { title: 'Änderungskonflikt', description };
  }
  if (error instanceof ApiError && error.status === 404) {
    return { title: 'Fehler', description: error.serverMessage || 'Dieser Eintrag existiert nicht mehr. Bitte laden Sie die Seite neu.' };
  }
  if (error instanceof TypeError) {
    return { title: 'Fehler', description: 'Netzwerkfehler' };
  }
  return { title: 'Fehler', description: fallback };
}
