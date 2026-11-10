'use client';

import { NetworkStatus } from '@apollo/client';
import { useEffect, useState } from 'react';

/**
 * When a polled query last answered without error. The query must run with
 * `notifyOnNetworkStatusChange: true`: each poll then goes back to `ready`, even
 * when the answer is the same as before, and that is the moment recorded here.
 */
export function useLastUpdated(networkStatus: NetworkStatus, failed: boolean): Date | null {
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    if (networkStatus === NetworkStatus.ready && !failed) setAt(new Date());
  }, [networkStatus, failed]);

  return at;
}

/** "10/11/2026, 14:23:05" — date and time, São Paulo or wherever the browser is. */
export function formatLastUpdated(date: Date): string {
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}
