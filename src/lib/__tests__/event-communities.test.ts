import { describe, expect, it } from 'vitest';

import {
  addableEventCommunities,
  canEditEventCommunities,
  canRemoveEventCommunity,
  eventCommunityIds,
} from '../event-communities';

const ADMIN = { role: 'admin', isAdmin: true, isCommunityManager: false, canAccessAdmin: true, communities: [] };
const ANA = { role: 'community-manager', isAdmin: false, isCommunityManager: true, canAccessAdmin: true, communities: [{ id: 'c1' }] };
const EVA = { role: 'event-manager', isAdmin: false, isCommunityManager: false, isEventManager: true, canAccessAdmin: true, communities: [] };
const ALL = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];

describe('event communities (REA-55)', () => {
  it('the admin adds and removes any, even the last one', () => {
    expect(addableEventCommunities(ADMIN, ALL, ['c1']).map(c => c.id)).toEqual(['c2', 'c3']);
    expect(canRemoveEventCommunity(ADMIN, 'c1', ['c1'])).toBe(true);
  });

  it('a community manager adds and removes only its own, never the last one', () => {
    expect(addableEventCommunities(ANA, ALL, ['c2']).map(c => c.id)).toEqual(['c1']);
    expect(addableEventCommunities(ANA, ALL, ['c1', 'c2'])).toEqual([]);
    expect(canRemoveEventCommunity(ANA, 'c1', ['c1', 'c2'])).toBe(true);
    expect(canRemoveEventCommunity(ANA, 'c2', ['c1', 'c2'])).toBe(false);
    expect(canRemoveEventCommunity(ANA, 'c1', ['c1'])).toBe(false);
  });

  it('an event manager changes nothing', () => {
    expect(canEditEventCommunities(EVA)).toBe(false);
    expect(addableEventCommunities(EVA, ALL, [])).toEqual([]);
    expect(canRemoveEventCommunity(EVA, 'c1', ['c1', 'c2'])).toBe(false);
  });

  it('outside the admin nothing is restricted', () => {
    expect(canEditEventCommunities(null)).toBe(true);
    expect(addableEventCommunities(null, ALL, ['c3']).map(c => c.id)).toEqual(['c1', 'c2']);
  });

  it('reads the ids of the event, without repeats or gaps', () => {
    expect(eventCommunityIds([{ id: 'c1' }, { id: null }, { id: 'c1' }, { id: 'c2' }])).toEqual(['c1', 'c2']);
    expect(eventCommunityIds(null)).toEqual([]);
  });
});
