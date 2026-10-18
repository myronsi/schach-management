import { useCallback, useRef, useState } from 'react';

/**
 * Tracks which items currently have an async action (e.g. a delete request) in flight, so the
 * corresponding buttons can be disabled and repeated clicks are ignored until the action settles.
 */
export function usePendingIds<K extends string | number>() {
  const pendingRef = useRef(new Set<K>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<K>>(() => new Set<K>());

  const isPending = useCallback((id: K) => pendingIds.has(id), [pendingIds]);

  /** Runs `action` for `id` unless an action for the same id is already running. */
  const runPending = useCallback(async (id: K, action: () => Promise<void>) => {
    if (pendingRef.current.has(id)) return;
    pendingRef.current.add(id);
    setPendingIds(new Set(pendingRef.current));
    try {
      await action();
    } finally {
      pendingRef.current.delete(id);
      setPendingIds(new Set(pendingRef.current));
    }
  }, []);

  return { isPending, runPending };
}
