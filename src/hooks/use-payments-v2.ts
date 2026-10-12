'use client';

import { useQuery } from '@apollo/client';

import { PAYMENTS_V2_PROBE } from '@/lib/queries';
import { paymentsV2FromProbe } from '@/lib/server-support';

import { useRefetchOnFocus } from './use-refetch-on-focus';

/**
 * Whether the BFF already has the REA-6 payment API (Opa Pingou, coupons, CPF).
 * null while asking. One request per page load (cache-first); while the answer is
 * "old server", asked again when the tab regains focus.
 */
export function usePaymentsV2(): boolean | null {
  const { data, loading, error, refetch } = useQuery(PAYMENTS_V2_PROBE, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'none',
    // A refetch keeps the current answer until the new one arrives (no flash to null).
    notifyOnNetworkStatusChange: false,
  });
  const supported = paymentsV2FromProbe({ loading, data, error });
  useRefetchOnFocus(refetch, supported === false);
  return supported;
}
