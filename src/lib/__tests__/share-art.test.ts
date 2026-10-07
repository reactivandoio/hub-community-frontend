import { describe, expect, it } from 'vitest';

import {
  SHARE_ART_LAYOUT,
  buildShareArtEvent,
  cleanShareArtName,
  fitWithin,
  formatShareArtDate,
  sameOriginImageUrl,
  shareArtFileName,
} from '../share-art';

describe('formatShareArtDate', () => {
  it('formats in São Paulo time, not UTC', () => {
    // 02:00 UTC on the 8th is still the 7th in São Paulo
    expect(formatShareArtDate('2026-10-08T02:00:00.000Z')).toBe('07 OUT 2026');
  });

  it('returns empty for missing or invalid dates', () => {
    expect(formatShareArtDate(null)).toBe('');
    expect(formatShareArtDate('not a date')).toBe('');
  });
});

describe('buildShareArtEvent', () => {
  const base = {
    slug: 'sw-anapolis',
    title: '  Startup Weekend Anápolis ',
    start_date: '2026-11-14T12:00:00.000Z',
    images: [null, 'https://manager.hubcommunity.io/uploads/cover.png'],
    location: { title: 'UniEVANGÉLICA', city: 'Anápolis' },
    communities: [
      { title: 'Techstars' },
      { title: '' },
      { title: 'GDG Anápolis' },
    ],
  };

  it('uses only data the event already has', () => {
    expect(buildShareArtEvent(base)).toEqual({
      title: 'Startup Weekend Anápolis',
      dateLabel: '14 NOV 2026',
      placeLabel: 'Anápolis',
      communityLabel: 'Techstars · GDG Anápolis',
      coverUrl: 'https://manager.hubcommunity.io/uploads/cover.png',
      link: 'hubcommunity.io/events/sw-anapolis',
    });
  });

  it('shows "Online" for online events and falls back when fields are missing', () => {
    expect(
      buildShareArtEvent({ is_online: true, location: { city: 'Goiânia' } })
    ).toEqual({
      title: 'Evento',
      dateLabel: '',
      placeLabel: 'Online',
      communityLabel: '',
      coverUrl: null,
      link: 'hubcommunity.io',
    });
  });

  it('falls back to the venue name when there is no city', () => {
    expect(
      buildShareArtEvent({ location: { title: 'Auditório' } }).placeLabel
    ).toBe('Auditório');
  });
});

describe('cleanShareArtName', () => {
  it('collapses spaces and caps the length', () => {
    expect(cleanShareArtName('  Pedro   Goiânia')).toBe('Pedro Goiânia');
    expect(cleanShareArtName('a'.repeat(40))).toHaveLength(25);
  });

  it('keeps a trailing space while the person is typing', () => {
    expect(cleanShareArtName('Pedro ')).toBe('Pedro ');
  });
});

describe('shareArtFileName', () => {
  it('builds an ASCII file name with role and ratio', () => {
    expect(shareArtFileName('sw-anapolis', 'Voluntário', 'story')).toBe(
      'sw-anapolis-voluntario-9x16.png'
    );
    expect(shareArtFileName('', 'Líder', 'feed')).toBe('evento-lider-1x1.png');
  });
});

describe('fitWithin', () => {
  it('keeps small images and scales the larger side down', () => {
    expect(fitWithin(800, 600, 1500)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(4000, 3000, 1500)).toEqual({ width: 1500, height: 1125 });
    expect(fitWithin(3000, 4000, 1500)).toEqual({ width: 1125, height: 1500 });
  });
});

describe('sameOriginImageUrl', () => {
  it('routes absolute URLs through the image proxy and leaves the rest alone', () => {
    expect(
      sameOriginImageUrl('https://manager.hubcommunity.io/uploads/a b.png')
    ).toBe(
      '/api/og-image?url=https%3A%2F%2Fmanager.hubcommunity.io%2Fuploads%2Fa%20b.png'
    );
    expect(sameOriginImageUrl('/images/logo-square.png')).toBe(
      '/images/logo-square.png'
    );
  });
});

describe('SHARE_ART_LAYOUT', () => {
  it('keeps the export ratio of each format', () => {
    expect(
      SHARE_ART_LAYOUT.story.height / SHARE_ART_LAYOUT.story.width
    ).toBeCloseTo(16 / 9);
    expect(SHARE_ART_LAYOUT.feed.height).toBe(SHARE_ART_LAYOUT.feed.width);
  });
});
