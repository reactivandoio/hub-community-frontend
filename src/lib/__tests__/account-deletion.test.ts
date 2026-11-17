import { describe, expect, it } from 'vitest';

import { formatEventDate, signupsLostOnDeletion, type MySignup } from '../account-deletion';

const signup = (id: string, event: Partial<MySignup['event']>, holds_place = true): MySignup => ({
  id,
  holds_place,
  event: { id: `ev-${id}`, title: id, ...event },
});

const NOW = new Date('2026-11-17T12:00:00Z');

describe('signupsLostOnDeletion', () => {
  it('keeps only signups holding a place in events that have not ended, soonest first', () => {
    const list = [
      signup('later', { start_date: '2027-02-01T10:00:00Z', end_date: '2027-02-01T18:00:00Z' }),
      signup('past', { start_date: '2026-10-01T10:00:00Z', end_date: '2026-10-01T18:00:00Z' }),
      signup('pending', { start_date: '2027-01-01T10:00:00Z' }, false),
      signup('happening', { start_date: '2026-11-17T10:00:00Z', end_date: '2026-11-17T20:00:00Z' }),
      signup('no-end', { start_date: '2026-12-01T10:00:00Z' }),
      signup('no-date', {}),
    ];
    expect(signupsLostOnDeletion(list, NOW).map(s => s.id)).toEqual(['happening', 'no-end', 'later']);
  });

  it('is empty without signups', () => {
    expect(signupsLostOnDeletion(null, NOW)).toEqual([]);
    expect(signupsLostOnDeletion(undefined, NOW)).toEqual([]);
  });
});

describe('formatEventDate', () => {
  it('formats in São Paulo time', () => {
    expect(formatEventDate('2026-12-01T01:00:00Z')).toBe('30 de novembro de 2026');
  });

  it('is null without a valid date', () => {
    expect(formatEventDate(null)).toBeNull();
    expect(formatEventDate('x')).toBeNull();
  });
});
