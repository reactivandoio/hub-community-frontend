'use client';

import { useQuery } from '@apollo/client';

import { PAYMENTS_V2_PROBE } from '@/lib/queries';
import { paymentsV2FromProbe } from '@/lib/server-support';

/**
 * Whether the BFF already has the REA-6 payment API (Opa Pingou, coupons, CPF).
 * null while asking. One request per page load (cache-first).
 */
export function usePaymentsV2(): boolean | null {
  const { data, loading, error } = useQuery(PAYMENTS_V2_PROBE, {
    fetchPolicy: 'cache-first',
    errorPolicy: 'none',
  });
  return paymentsV2FromProbe({ loading, data, error });
}
