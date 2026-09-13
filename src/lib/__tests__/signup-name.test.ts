import { describe, it, expect } from 'vitest';
import { signupName } from '@/lib/signup-name';

describe('signupName', () => {
  it('uses the full name when the account has one', () => {
    expect(signupName({ email: 'ana@x.io', username: 'ana-4f2k', name: 'Ana Souza' })).toBe('Ana Souza');
  });

  it('trims the full name', () => {
    expect(signupName({ email: 'ana@x.io', username: 'ana-4f2k', name: '  Ana Souza ' })).toBe('Ana Souza');
  });

  it('falls back to the username when the name is missing or blank', () => {
    // Sessions saved before `name` was persisted, or Strapi users without one.
    expect(signupName({ email: 'ana@x.io', username: 'ana-4f2k' })).toBe('ana-4f2k');
    expect(signupName({ email: 'ana@x.io', username: 'ana-4f2k', name: '   ' })).toBe('ana-4f2k');
  });

  it('falls back to the e-mail prefix when there is no username either', () => {
    expect(signupName({ email: 'ana.souza@x.io', username: '' })).toBe('ana.souza');
  });
});
