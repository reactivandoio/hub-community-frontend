import { describe, expect, it } from 'vitest';

import { inviteClosedMessage, inviteDestination, inviteWhat } from '../management-invite';

const base = { role: 'event-manager', communityId: null, communityTitle: null, eventId: null, eventSlug: null, eventTitle: null };

describe('management invite (REA-48)', () => {
  it('says what the invite is for', () => {
    expect(inviteWhat({ kind: 'event_manager', eventTitle: 'Meetup', communityTitle: null })).toBe('gerir o evento Meetup');
    expect(inviteWhat({ kind: 'community_organizer', communityTitle: 'Devs', eventTitle: null })).toBe('organizar a comunidade Devs');
  });

  it('sends a manager to the event and an organizer to the events', () => {
    expect(inviteDestination({ ...base, kind: 'event_manager', eventId: 'ev-1' })).toBe('/admin/events/ev-1');
    expect(inviteDestination({ ...base, kind: 'community_organizer', communityId: 'c-1' })).toBe('/admin/events');
  });

  it('explains an invite that no longer works', () => {
    expect(inviteClosedMessage('pending')).toBeNull();
    expect(inviteClosedMessage('expired')).toMatch(/expirou/);
    expect(inviteClosedMessage('revoked')).toMatch(/cancelado/);
    expect(inviteClosedMessage('accepted')).toMatch(/já foi aceito/);
  });
});
