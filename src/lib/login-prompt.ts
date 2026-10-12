/**
 * Login in place (REA-25): asking for a session opens the login modal over the current page
 * instead of sending the person to the home page. Pure rules shared by the LoginPrompt
 * provider, the pages that need a session and the e-mail pages (confirmation, password).
 *
 * The real protection is the BFF; this only shapes the experience.
 */

// Any URL resolved against it stays on it only when the path is of this site.
const SAME_SITE_BASE = 'https://same-site.invalid';

/**
 * A path of this site, or null. Refuses //host, a scheme, backslashes and control characters:
 * browsers drop tabs and line breaks while parsing, so "/\t/evil.com" would become "//evil.com"
 * (another site). The last word is the URL parser itself: the origin must not change.
 */
export function safeReturnPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  try {
    const url = new URL(path, SAME_SITE_BASE);
    if (url.origin !== SAME_SITE_BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Old links (e-mails, favorites, the REA-10 admin redirect): `?login=true&redirect=/x`.
 * Returns where the person should be (the redirect, or the current page without the login
 * params) with the modal open, or null when the URL is not one of them.
 */
export function legacyLoginTarget(
  pathname: string,
  search: string,
  hash = '',
): { path: string } | null {
  const params = new URLSearchParams(search);
  if (params.get('login') !== 'true') return null;
  const redirect = safeReturnPath(params.get('redirect'));
  if (redirect) return { path: redirect };
  params.delete('login');
  params.delete('redirect');
  const rest = params.toString();
  return { path: `${pathname}${rest ? `?${rest}` : ''}${hash}` };
}

/**
 * Signing up and "esqueci minha senha" finish in an e-mail, often in another tab. The page
 * the person was on is kept here, so the confirmation and the new-password pages can send
 * them back to it after the login.
 */
const RETURN_KEY = 'login_return_to';
// Long enough to find the e-mail, short enough not to surprise someone another day.
const RETURN_TTL_MS = 24 * 60 * 60 * 1000;

export function saveLoginReturn(path: string, now: number = Date.now()): void {
  const safe = safeReturnPath(path);
  if (!safe) return;
  try {
    window.localStorage.setItem(RETURN_KEY, JSON.stringify({ path: safe, savedAt: now }));
  } catch {
    // Private mode or blocked storage: the person lands on the home page, as before.
  }
}

/** The kept page (and forgets it), or null when there is none or it expired. */
export function takeLoginReturn(now: number = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(RETURN_KEY);
    const { path, savedAt } = JSON.parse(raw) as { path?: string; savedAt?: number };
    if (typeof savedAt !== 'number' || now - savedAt > RETURN_TTL_MS) return null;
    return safeReturnPath(path);
  } catch {
    return null;
  }
}

/** The current page, query and fragment included (the coupon link lives in the fragment). */
export function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}
