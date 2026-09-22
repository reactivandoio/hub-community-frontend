import { describe, it, expect } from 'vitest';
import { ORIGIN_LABELS, absentCount, hourLabel, originSummary } from '../checkin-analytics';

describe('checkin analytics helpers', () => {
  it('names every signup origin in Portuguese', () => {
    expect(ORIGIN_LABELS).toEqual({
      SITE: 'Site / QR',
      MANUAL: 'Cadastro manual',
      IMPORT: 'Planilha',
    });
  });

  it('counts who signed up and did not check in', () => {
    expect(absentCount(120, 85)).toBe(35);
    expect(absentCount(0, 0)).toBe(0);
    // A check-in of a signup deleted later must not go negative.
    expect(absentCount(3, 4)).toBe(0);
  });

  it('labels an hour bucket as HHh', () => {
    expect(hourLabel('2026-09-25T18:00')).toBe('18h');
    expect(hourLabel('2026-09-25T09:00')).toBe('09h');
  });

  it('summarises the day-of signups by origin, leaving out empty ones', () => {
    expect(
      originSummary([
        { origin: 'SITE', count: 12 },
        { origin: 'MANUAL', count: 3 },
        { origin: 'IMPORT', count: 0 },
      ]),
    ).toBe('12 site / QR · 3 cadastro manual');
    expect(originSummary([{ origin: 'SITE', count: 0 }])).toBe('');
  });
});
