import { describe, it, expect } from 'vitest';
import { centsToReais, formatCents, reaisToCents } from '../money';

describe('reaisToCents', () => {
  it('converts what the admin types (reais) to the stored cents', () => {
    expect(reaisToCents(50)).toBe(5000);
    expect(reaisToCents('35.9')).toBe(3590);
    expect(reaisToCents('35,90')).toBe(3590);
  });

  it('rounds float noise instead of truncating', () => {
    expect(reaisToCents(0.29)).toBe(29);
    expect(reaisToCents(19.99)).toBe(1999);
  });

  it('treats empty, invalid and negative input as free', () => {
    expect(reaisToCents('')).toBe(0);
    expect(reaisToCents(undefined)).toBe(0);
    expect(reaisToCents('abc')).toBe(0);
    expect(reaisToCents(-5)).toBe(0);
  });
});

describe('centsToReais', () => {
  it('is the inverse of reaisToCents', () => {
    expect(centsToReais(5000)).toBe(50);
    expect(centsToReais(3590)).toBe(35.9);
    expect(reaisToCents(centsToReais(1999))).toBe(1999);
  });

  it('handles missing values', () => {
    expect(centsToReais(undefined)).toBe(0);
    expect(centsToReais(null)).toBe(0);
  });
});

describe('formatCents', () => {
  it('formats cents as BRL', () => {
    expect(formatCents(5000)).toBe('R$ 50,00');
    expect(formatCents(123456)).toBe('R$ 1.234,56');
  });
});
