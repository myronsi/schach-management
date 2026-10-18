export function hasFieldChanges<T extends object>(
  form: Partial<T>,
  original: T,
  keys: readonly (keyof T)[],
): boolean {
  return keys.some(key => String(form[key] ?? '') !== String(original[key] ?? ''));
}
