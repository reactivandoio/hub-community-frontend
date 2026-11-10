import { print } from 'graphql';

import { UNSUBSCRIBE_EMAIL } from '@/lib/queries';

// Server side of the one-click unsubscribe (REA-29), kept apart from certificate-server so the
// route does not load @react-pdf/renderer.

const graphqlUrl = () =>
  process.env.GRAPHQL_URL || process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';

/** True when the BFF recorded the unsubscribe; false for an invalid token. Throws when unreachable. */
export async function unsubscribeByToken(token: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!token || token.length > 512) return false;
  const res = await fetchImpl(graphqlUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: print(UNSUBSCRIBE_EMAIL), variables: { token } }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`BFF respondeu ${res.status}`);
  const body = await res.json();
  if (body?.errors?.length) throw new Error(body.errors[0]?.message || 'erro');
  return body?.data?.unsubscribeEmail === true;
}
