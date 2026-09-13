import type { User } from '@/lib/types';

/**
 * Name to register a logged-in user with when they sign up for an event.
 * This is what shows up on the participant list and the printed badge, so it must
 * be the full name; username / e-mail prefix are only a last resort (sessions saved
 * before `name` was persisted in `auth_user`, or accounts without a name).
 */
export function signupName(user: Pick<User, 'name' | 'username' | 'email'>): string {
  return user.name?.trim() || user.username || user.email.split('@')[0];
}
