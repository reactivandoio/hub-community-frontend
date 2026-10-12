'use client';

import { useQuery } from '@apollo/client';

import { EVENT_SIGNUPS, EVENT_SIGNUPS_HALF_PRICE, EVENT_SIGNUP_FIELDS } from '@/lib/queries';
import { typeHasField } from '@/lib/server-support';

import { useRefetchOnFocus } from './use-refetch-on-focus';

/**
 * REA-16: the signups query to use. The one with `half_price` only once the BFF's
 * EventSignup has it, so this page never asks for a field the server lacks.
 * null while asking; without the field, asked again when the tab regains focus.
 */
export function useEventSignupsQuery(): typeof EVENT_SIGNUPS | null {
  const { data, loading, error, refetch } = useQuery(EVENT_SIGNUP_FIELDS, { fetchPolicy: 'cache-first' });
  const hasField = typeHasField({ loading, data, error }, 'half_price');
  useRefetchOnFocus(refetch, hasField === false);
  if (hasField === null) return null;
  return hasField ? EVENT_SIGNUPS_HALF_PRICE : EVENT_SIGNUPS;
}
