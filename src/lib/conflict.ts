export function isConflictError(error: unknown): boolean {
  if (!error) return false;
  const candidate = error as { conflict?: boolean; name?: string; message?: string };
  const message = candidate.message || '';
  return candidate.conflict === true || candidate.name === 'ConflictError' || /zwischenzeitlich geändert|\bconflict\b/i.test(message);
}

export function conflictDescription(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return message || 'Dieser Eintrag wurde zwischenzeitlich von einem anderen Benutzer geändert. Bitte neu laden und die Änderungen erneut prüfen.';
}
