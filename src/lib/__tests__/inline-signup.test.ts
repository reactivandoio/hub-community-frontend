import { describe, it, expect } from 'vitest';
import {
  cleanSignupPhone,
  guestSignupSuccessMessage,
  inlineSignupSchema,
} from '../inline-signup';

const valid = { name: 'Maria Souza', email: 'maria@exemplo.com', phone: '+55 11 98765-4321' };

describe('inlineSignupSchema', () => {
  it('accepts name, email and phone with no password', () => {
    const result = inlineSignupSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('does not keep a password field', () => {
    const result = inlineSignupSchema.safeParse({ ...valid, password: 'secret123' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty('password');
  });

  it('rejects a short name', () => {
    const result = inlineSignupSchema.safeParse({ ...valid, name: 'Jo' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = inlineSignupSchema.safeParse({ ...valid, email: 'maria' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid phone', () => {
    const result = inlineSignupSchema.safeParse({ ...valid, phone: 'abc' });
    expect(result.success).toBe(false);
  });
});

describe('cleanSignupPhone', () => {
  it('drops characters outside digits, +, spaces, parentheses and dashes', () => {
    expect(cleanSignupPhone('+55 (11) 98765-4321.')).toBe('+55 (11) 98765-4321');
  });
});

describe('guestSignupSuccessMessage', () => {
  it('tells where the ticket and the set-password link went', () => {
    expect(guestSignupSuccessMessage('maria@exemplo.com')).toBe(
      'Enviamos seu ingresso e o link para criar sua senha para maria@exemplo.com',
    );
  });
});
