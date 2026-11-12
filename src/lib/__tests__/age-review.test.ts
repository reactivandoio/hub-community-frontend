import { describe, expect, it } from 'vitest';

import { ageReviewStatusLabel, canBlockMinor, canRequestDateOfBirth, formatIsoDate } from '../age-review';
import type { AgeReviewUser } from '../types';

const user = (over: Partial<AgeReviewUser> = {}): AgeReviewUser => ({
  id: '1', username: null, email: 'a@x.io', name: null, blocked: false, createdAt: null, dateOfBirth: null, age: null,
  adultDeclaredAt: null, status: null, requestedAt: null, deadline: null, blockedAt: null, ...over,
});
const now = new Date('2026-11-12T15:00:00.000Z');

describe('ageReviewStatusLabel', () => {
  it('names each situation', () => {
    expect(ageReviewStatusLabel(user(), now)).toBe('Sem ação');
    expect(ageReviewStatusLabel(user({ status: 'dob_requested', deadline: '2026-11-15T00:00:00.000Z' }), now)).toBe('Aguardando a data');
    expect(ageReviewStatusLabel(user({ status: 'dob_requested', deadline: '2026-11-10T00:00:00.000Z' }), now)).toBe('Prazo vencido: será desativada');
    expect(ageReviewStatusLabel(user({ blocked: true, status: 'dob_blocked' }), now)).toBe('Desativada (sem data de nascimento)');
    expect(ageReviewStatusLabel(user({ blocked: true, status: 'minor_blocked' }), now)).toBe('Desativada (menor de idade)');
    expect(ageReviewStatusLabel(user({ blocked: true }), now)).toBe('Desativada');
  });
});

describe('actions', () => {
  it('asks for the date only of active accounts not asked yet', () => {
    expect(canRequestDateOfBirth(user())).toBe(true);
    expect(canRequestDateOfBirth(user({ status: 'dob_requested' }))).toBe(false);
    expect(canRequestDateOfBirth(user({ blocked: true }))).toBe(false);
  });
  it('blocks an active minor or re-sends to one blocked as a minor', () => {
    expect(canBlockMinor(user({ dateOfBirth: '2010-01-01' }))).toBe(true);
    expect(canBlockMinor(user({ blocked: true, status: 'minor_blocked' }))).toBe(true);
    expect(canBlockMinor(user({ blocked: true }))).toBe(false);
  });
  it('formats an ISO date', () => {
    expect(formatIsoDate('2010-05-05')).toBe('05/05/2010');
    expect(formatIsoDate(null)).toBe('—');
  });
});
