/**
 * REA-48 — the /convite page: what an invite leads to. Pure, tested.
 */

export interface ManagementInvitePreview {
  kind: string;
  status: string;
  maskedEmail: string;
  communityTitle: string | null;
  eventTitle: string | null;
  expiresAt: string | null;
}

export interface ManagementInviteAcceptance {
  kind: string;
  role: string | null;
  communityId: string | null;
  communityTitle: string | null;
  eventId: string | null;
  eventSlug: string | null;
  eventTitle: string | null;
}

/** "gerir o evento Meetup" / "organizar a comunidade Devs". */
export function inviteWhat(invite: Pick<ManagementInvitePreview, 'kind' | 'communityTitle' | 'eventTitle'>): string {
  return invite.kind === 'community_organizer'
    ? `organizar a comunidade ${invite.communityTitle || ''}`.trim()
    : `gerir o evento ${invite.eventTitle || ''}`.trim();
}

/** Where the person goes once the invite is accepted. */
export function inviteDestination(acceptance: ManagementInviteAcceptance): string {
  if (acceptance.kind === 'event_manager' && acceptance.eventId) {
    return `/admin/events/${encodeURIComponent(acceptance.eventId)}`;
  }
  if (acceptance.kind === 'community_organizer') return '/admin/events';
  return '/admin';
}

/** The message of an invite that cannot be accepted any more, or null when it is pending. */
export function inviteClosedMessage(status: string): string | null {
  switch (status) {
    case 'pending':
      return null;
    case 'accepted':
      return 'Este convite já foi aceito.';
    case 'revoked':
      return 'Este convite foi cancelado. Peça um novo a quem convidou você.';
    case 'expired':
      return 'Este convite expirou. Peça um novo a quem convidou você.';
    default:
      return 'Este convite não vale mais.';
  }
}
