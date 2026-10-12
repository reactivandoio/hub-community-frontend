'use client';

import { useEffect, useRef } from 'react';

const MIN_INTERVAL_MS = 10_000;

/**
 * Asks again when the tab comes back to the front, while `active`. For the server
 * probes: a page opened before a BFF deploy keeps the old answer for the whole
 * load, and only a reload (F5) showed the new features.
 */
export function useRefetchOnFocus(refetch: () => Promise<unknown>, active: boolean): void {
  const last = useRef(0);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!active) return undefined;
    const ask = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - last.current < MIN_INTERVAL_MS) return;
      last.current = now;
      // A failed probe keeps the page as it is; the next focus tries again.
      refetchRef.current().catch(() => undefined);
    };
    window.addEventListener('focus', ask);
    document.addEventListener('visibilitychange', ask);
    return () => {
      window.removeEventListener('focus', ask);
      document.removeEventListener('visibilitychange', ask);
    };
  }, [active]);
}
