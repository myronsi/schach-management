import { useCallback, useRef, useState } from 'react';

export function usePendingIds<K extends string | number>() {
  const pendingRef = useRef(new Set<K>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<K>>(() => new Set<K>());

  const isPending = useCallback((id: K) => pendingIds.has(id), [pendingIds]);

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
