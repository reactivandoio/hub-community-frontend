import { describe, expect, it } from 'vitest';

import { audienceSummary, campaignKinds, defaultSubject, isActive, progressPercent } from '@/lib/email-campaign';

const audience = { total: 1240, approximate: true, daily_limit: 70, estimated_days: 18, sending_enabled: true, redirect_to: null };

describe('campaignKinds', () => {
  it('shows the invite to the whole base only to an admin', () => {
    expect(campaignKinds(true).map((k) => k.type)).toEqual(['invite', 'share', 'reminder']);
    expect(campaignKinds(false).map((k) => k.type)).toEqual(['share', 'reminder']);
  });
});

describe('defaultSubject', () => {
  it('matches the BFF subjects', () => {
    expect(defaultSubject('invite', 'Meetup')).toBe('📣 Você está convidado: Meetup');
    expect(defaultSubject('share', 'Meetup')).toBe('🤝 Convide alguém para Meetup');
    expect(defaultSubject('reminder', null)).toBe('⏰ Lembrete: evento está chegando');
  });
});

describe('progressPercent', () => {
  it('counts sent and failed over the audience', () => {
    expect(progressPercent({ sent: 30, failed: 5, total: 70, status: 'sending' })).toBe(50);
    expect(progressPercent({ sent: 0, failed: 0, total: 0, status: 'sending' })).toBe(0);
    expect(progressPercent({ sent: 90, failed: 0, total: 70, status: 'sending' })).toBe(100);
    expect(progressPercent({ sent: 60, failed: 0, total: 70, status: 'done' })).toBe(100);
  });
});

describe('isActive', () => {
  it('is sending or paused', () => {
    expect(isActive({ status: 'sending' })).toBe(true);
    expect(isActive({ status: 'paused' })).toBe(true);
    expect(isActive({ status: 'done' })).toBe(false);
  });
});

describe('audienceSummary', () => {
  it('tells the size and how many days it takes', () => {
    expect(audienceSummary(audience)).toBe('até 1.240 pessoas · cerca de 18 dias (70 por dia)');
    expect(audienceSummary({ ...audience, total: 1, approximate: false, estimated_days: 1 })).toBe('1 pessoa · sai hoje');
    expect(audienceSummary({ ...audience, total: 0, approximate: false, estimated_days: 0 })).toBe('0 pessoas');
  });
});
