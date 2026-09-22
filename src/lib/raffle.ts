/**
 * Loads the /sorteio draw straight from an event: only the people who checked
 * in take part. The same e-mail signed up twice counts once; two different
 * people who share a name both stay in.
 */
export interface RaffleSignup {
  id: string;
  name: string;
  email?: string | null;
  checked_in?: boolean | null;
}

export const RAFFLE_EVENT_PARAM = 'event';

export function raffleUrl(eventSlug: string): string {
  return `/sorteio?${RAFFLE_EVENT_PARAM}=${encodeURIComponent(eventSlug)}`;
}

export function raffleNamesFromSignups(signups: RaffleSignup[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const signup of signups) {
    if (!signup.checked_in) continue;
    const name = (signup.name || '').trim();
    if (!name) continue;

    const key = (signup.email || '').trim().toLowerCase() || `id:${signup.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}
