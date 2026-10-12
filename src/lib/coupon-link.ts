import { normalizeCouponCode } from './coupon';

// Ready-made coupon link (REA-18): the event URL with the code in the fragment,
// /events/<slug>#cupom=PROMO10. The fragment never reaches the server or an access
// log. The link only fills the code in: the discount is still the server's.

export const COUPON_HASH_KEY = 'cupom';

const STORAGE_PREFIX = 'pending_coupon:';
// Long enough for a signup with e-mail confirmation, short enough not to surprise
// someone who comes back another day.
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CODE_LENGTH = 64;

/** "#cupom=PROMO10", or "" without a code. */
export function couponHash(code: string | null | undefined): string {
  const normalized = normalizeCouponCode(code || '');
  return normalized ? `#${COUPON_HASH_KEY}=${encodeURIComponent(normalized)}` : '';
}

/** Public event URL that applies the coupon on signup. */
export function couponLink(origin: string, eventSlug: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/events/${encodeURIComponent(eventSlug)}${couponHash(code)}`;
}

/**
 * Coupon code in a URL fragment, normalized, or null. Any other fragment
 * (anchors, tabs such as "#products") is left alone.
 */
export function couponFromHash(hash: string | null | undefined): string | null {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw.includes('=')) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return null;
  }
  for (const [key, value] of params) {
    if (key.toLowerCase() !== COUPON_HASH_KEY) continue;
    const code = normalizeCouponCode(value);
    return code && code.length <= MAX_CODE_LENGTH ? code : null;
  }
  return null;
}

const storageKey = (eventKey: string) => `${STORAGE_PREFIX}${eventKey}`;

/** Remembers the coupon of an event across login, signup and the redirect back. */
export function savePendingCoupon(eventKey: string, code: string, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(storageKey(eventKey), JSON.stringify({ code, savedAt: now }));
  } catch {
    // Private mode or blocked storage: the fragment in the URL still carries it.
  }
}

export function readPendingCoupon(eventKey: string, now: number = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(storageKey(eventKey));
    if (!raw) return null;
    const saved = JSON.parse(raw) as { code?: unknown; savedAt?: unknown };
    const code = normalizeCouponCode(typeof saved.code === 'string' ? saved.code : '');
    const savedAt = Number(saved.savedAt);
    if (!code || !Number.isFinite(savedAt) || now - savedAt > PENDING_TTL_MS) {
      window.localStorage.removeItem(storageKey(eventKey));
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

/**
 * Fragment to append to a path that leads to the signup (the login redirect, for
 * one), read straight from the browser: usable before any state has settled.
 */
export function pendingCouponHash(eventKey: string): string {
  if (typeof window === 'undefined') return '';
  return couponHash(couponFromHash(window.location.hash) || readPendingCoupon(eventKey));
}

export function clearPendingCoupon(eventKey: string): void {
  try {
    window.localStorage.removeItem(storageKey(eventKey));
  } catch {
    // Nothing to clear.
  }
}
