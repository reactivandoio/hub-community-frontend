import { describe, expect, it } from 'vitest';

import {
  RESEND_COOLDOWN_SECONDS,
  canResendConfirmation,
  confirmationEmailFailed,
  resendWait,
  resentNote,
} from '../confirmation-email';

const base = { signup_id: '42', email: 'ana@x.io' };

describe('canResendConfirmation (REA-50)', () => {
  it('shows on confirmed signups: without payment, paid or approved by hand', () => {
    expect(canResendConfirmation({ ...base, payment_status: null })).toBe(true);
    expect(canResendConfirmation({ ...base, payment_status: 'CONFIRMED' })).toBe(true);
  });

  it('never on pending, expired, canceled or refunded ones', () => {
    for (const status of ['PEDING_PAYMENT', 'EXPIRED', 'CANCELED', 'REFUND']) {
      expect(canResendConfirmation({ ...base, payment_status: status })).toBe(false);
    }
  });

  it('needs the signup id and an e-mail', () => {
    expect(canResendConfirmation({ email: 'ana@x.io' })).toBe(false);
    expect(canResendConfirmation({ signup_id: '42', email: '' })).toBe(false);
  });
});

describe('the rest of the row', () => {
  it('flags a failed send', () => {
    expect(confirmationEmailFailed({ confirmation_email_status: 'failed' })).toBe(true);
    expect(confirmationEmailFailed({ confirmation_email_status: 'sent' })).toBe(false);
    expect(confirmationEmailFailed({})).toBe(false);
  });

  it('says when it was last resent, in Brasília time', () => {
    expect(resentNote('2026-11-15T13:30:00.000Z')).toBe('Reenviado em 15/11/2026 10:30');
    expect(resentNote(null)).toBe('');
  });

  it('waits a minute after a resend', () => {
    const now = new Date('2026-11-15T13:30:20.000Z');
    expect(resendWait('2026-11-15T13:30:00.000Z', now)).toBe(RESEND_COOLDOWN_SECONDS - 20);
    expect(resendWait('2026-11-15T13:20:00.000Z', now)).toBe(0);
    expect(resendWait(null, now)).toBe(0);
  });
});
