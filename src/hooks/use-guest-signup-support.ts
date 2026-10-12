'use client';

import { useQuery } from '@apollo/client';

import { SIGNUP_RESPONSE_FIELDS } from '@/lib/queries';
import { typeHasField } from '@/lib/server-support';

import { useRefetchOnFocus } from './use-refetch-on-focus';

/**
 * REA-22: whether the BFF already signs up without login with the CPF and e-mail
 * rules (and therefore paid batches too). null while asking; false keeps today's
 * behaviour (free batches only, paid ones through the login). Asked again when the
 * tab regains focus while the answer is no.
 */
export function useGuestSignupSupport(): boolean | null {
  const { data, loading, error, refetch } = useQuery(SIGNUP_RESPONSE_FIELDS, { fetchPolicy: 'cache-first' });
  const supported = typeHasField({ loading, data, error }, 'outcome');
  useRefetchOnFocus(refetch, supported === false);
  return supported;
}
