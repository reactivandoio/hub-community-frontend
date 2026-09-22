/**
 * Client-side dedupe for the event signup form: a short (event, e-mail) lock
 * against double-submits on reloads and flaky networks. The backend has no
 * unique index on (event, email) for participants, so this is the guard.
 *
 * A failed attempt must release the lock — otherwise the person who fixes a
 * rejected password is told "Inscrição em andamento" instead of retrying.
 */
export const SIGNUP_LOCK_MS = 30_000;

type LockOptions = { storage?: Storage; now?: number };

const defaultStorage = () =>
  typeof sessionStorage !== 'undefined' ? sessionStorage : undefined;

const lockKey = (eventId: string, email: string) =>
  `signup_lock_${eventId}_${email.toLowerCase()}`;

/** Returns false while another attempt for the same event and e-mail holds the lock. */
export function acquireSignupLock(
  eventId: string,
  email: string,
  { storage = defaultStorage(), now = Date.now() }: LockOptions = {},
): boolean {
  if (!storage) return true;
  const key = lockKey(eventId, email);
  const existing = storage.getItem(key);
  if (existing && now - Number(existing) < SIGNUP_LOCK_MS) return false;
  storage.setItem(key, String(now));
  return true;
}

export function releaseSignupLock(
  eventId: string,
  email: string,
  { storage = defaultStorage() }: Pick<LockOptions, 'storage'> = {},
): void {
  storage?.removeItem(lockKey(eventId, email));
}
