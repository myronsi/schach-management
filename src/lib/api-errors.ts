import { httpUtils } from '@/lib/auth-utils';
import { conflictDescription, isConflictError } from '@/lib/conflict';

/** Common shape of JSON responses returned by the PHP API. */
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

/** Error thrown for a failed API call; carries the HTTP status and the server's error flags. */
export class ApiError extends Error {
  status: number;
  code?: string;
  conflict: boolean;
  locked: boolean;
  lockedBy?: string;
  /** Message text sent by the server, if any. */
  serverMessage?: string;

  constructor(message: string, status: number, body: ApiResponseBody = {}) {
    super(message);
    this.status = status;
    this.code = typeof body.code === 'string' ? body.code : undefined;
    // Only an explicit `conflict: true` marks an edit conflict. Other 409s (e.g. duplicate slug) are not.
    this.conflict = body.conflict === true;
    this.locked = status === 423 || body.locked === true;
    this.lockedBy = typeof body.locked_by === 'string' ? body.locked_by : undefined;
    this.serverMessage = body.message || body.error || undefined;
    this.name = this.conflict ? 'ConflictError' : this.locked ? 'LockedError' : 'ApiError';
  }
}

/** Reads a JSON body, returning an empty object if the body is missing or not JSON. */
export async function readJson<T extends object = ApiResponseBody>(res: Response): Promise<T & ApiResponseBody> {
  try {
    const data: unknown = await res.json();
    return (data && typeof data === 'object' ? data : {}) as T & ApiResponseBody;
  } catch {
    return {} as T & ApiResponseBody;
  }
}

/** Builds an ApiError from a response and its (already parsed) body. */
export function toApiError(res: Response, body: ApiResponseBody, fallbackMessage = 'Anfrage fehlgeschlagen'): ApiError {
  const message = body.message || body.error || fallbackMessage;
  return new ApiError(message, res.status, body);
}

/** Throws an ApiError unless the response is OK and the body does not report `success: false`. */
export async function parseApiResponse<T extends object = ApiResponseBody>(res: Response, fallbackMessage?: string): Promise<T & ApiResponseBody> {
  const body = await readJson<T>(res);
  if (!res.ok || body.success === false) {
    throw toApiError(res, body, fallbackMessage);
  }
  return body;
}

/** POSTs a JSON payload with auth headers and returns the parsed body; throws ApiError on failure. */
export async function postJson<T extends object = ApiResponseBody>(url: string, payload: unknown, fallbackMessage = 'Speichern fehlgeschlagen'): Promise<T & ApiResponseBody> {
  const res = await httpUtils.post(url, payload);
  return parseApiResponse<T>(res, fallbackMessage);
}

/** Sends an authenticated DELETE with a JSON body; throws ApiError on failure. */
export async function deleteJson<T extends object = ApiResponseBody>(url: string, payload: unknown, fallbackMessage = 'Löschen fehlgeschlagen'): Promise<T & ApiResponseBody> {
  const res = await httpUtils.delete(url, payload);
  return parseApiResponse<T>(res, fallbackMessage);
}

export function isLockedError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.locked;
}

export const LOCKED_TITLE = 'Gesperrt';

/**
 * Maps an error to a user-facing German title/description:
 * - locked (HTTP 423)  -> 'Gesperrt' with the server message
 * - edit conflict      -> 'Änderungskonflikt'
 * - 404 on update      -> entry no longer exists
 * - network failure    -> 'Netzwerkfehler'
 * - anything else      -> 'Fehler' with the given fallback text
 */
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
