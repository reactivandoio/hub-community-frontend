/**
 * Ticket QR contract shared with the mobile kiosk
 * (hub-community-mobile/docs/superpowers/specs/2026-09-18-kiosk-mode-design.md).
 *
 * The QR carries the signup page URL with the signup id, so a phone camera
 * opens something useful while the kiosk only reads `?ticket=`.
 */
export const TICKET_PARAM = 'ticket';

export function ticketUrl(eventSlug: string, signupId: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://hubcommunity.io');
  return `${base.replace(/\/$/, '')}/events/${encodeURIComponent(eventSlug)}/signup?${TICKET_PARAM}=${encodeURIComponent(signupId)}`;
}
