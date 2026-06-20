const CONSENT_KEY = 'hub_cookie_consent';
const CONSENT_DATE_KEY = 'hub_cookie_consent_date';

/**
 * Check if the user has already given cookie consent.
 */
export function hasConsented(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'true';
}

/**
 * Save the user's cookie consent with a timestamp.
 */
export function setConsent(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONSENT_KEY, 'true');
  localStorage.setItem(CONSENT_DATE_KEY, new Date().toISOString());
}

/**
 * Get the date the user gave consent, or null if not consented.
 */
export function getConsentDate(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CONSENT_DATE_KEY);
}
