import { describe, it, expect } from 'vitest';
import { maskBirthDate, parseBirthDate } from '../birth-date';

const NOW = new Date('2026-10-08T12:00:00Z');

describe('maskBirthDate', () => {
  it('adds the slashes while typing and drops anything else', () => {
    expect(maskBirthDate('0')).toBe('0');
    expect(maskBirthDate('070')).toBe('07/0');
    expect(maskBirthDate('07041')).toBe('07/04/1');
    expect(maskBirthDate('07a04-1990')).toBe('07/04/1990');
    expect(maskBirthDate('0704199012')).toBe('07/04/1990');
  });
});

describe('parseBirthDate', () => {
  it('turns DD/MM/AAAA into YYYY-MM-DD', () => {
    expect(parseBirthDate('07/04/1990', NOW)).toBe('1990-04-07');
    expect(parseBirthDate('29/02/2000', NOW)).toBe('2000-02-29');
  });

  it('refuses days that do not exist, the future, before 1900 and incomplete input', () => {
    expect(parseBirthDate('31/02/1990', NOW)).toBeNull();
    expect(parseBirthDate('29/02/2001', NOW)).toBeNull();
    expect(parseBirthDate('13/13/1990', NOW)).toBeNull();
    expect(parseBirthDate('09/10/2026', NOW)).toBeNull();
    expect(parseBirthDate('01/01/1899', NOW)).toBeNull();
    expect(parseBirthDate('07/04/90', NOW)).toBeNull();
    expect(parseBirthDate('', NOW)).toBeNull();
  });
});
