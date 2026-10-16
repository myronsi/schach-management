/**
 * Returns true if any of the given fields differs between the edited form and the original record.
 * Values are compared as strings, with null/undefined treated as an empty string
 * (so `undefined` vs `''` and `5` vs `'5'` count as unchanged).
 */
export function hasFieldChanges<T extends object>(
  form: Partial<T>,
  original: T,
  keys: readonly (keyof T)[],
): boolean {
  return keys.some(key => String(form[key] ?? '') !== String(original[key] ?? ''));
}
