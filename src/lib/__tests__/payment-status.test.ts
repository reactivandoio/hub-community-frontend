import { describe, it, expect } from 'vitest';
import { paymentPhase, paymentStatusLabel, isTerminalPhase, summarizePayments } from '../payment-status';

const NOW = new Date('2026-11-01T12:00:00Z');

describe('paymentPhase', () => {
  it('maps a confirmed payment to paid', () => {
    expect(paymentPhase({ status: 'CONFIRMED' }, NOW)).toBe('paid');
  });

  it('keeps a pending payment pending until it expires', () => {
    expect(paymentPhase({ status: 'PEDING_PAYMENT', expires_at: '2026-11-01T12:30:00Z' }, NOW)).toBe('pending');
    expect(paymentPhase({ status: 'PEDING_PAYMENT', expires_at: null }, NOW)).toBe('pending');
  });

  it('treats a pending payment past its expiry as expired (the webhook may still be on its way)', () => {
    expect(paymentPhase({ status: 'PEDING_PAYMENT', expires_at: '2026-11-01T11:59:59Z' }, NOW)).toBe('expired');
  });

  it('maps expired, canceled and refunded', () => {
    expect(paymentPhase({ status: 'EXPIRED' }, NOW)).toBe('expired');
    expect(paymentPhase({ status: 'CANCELED' }, NOW)).toBe('canceled');
    expect(paymentPhase({ status: 'REFUND' }, NOW)).toBe('refunded');
  });

  it('falls back to pending for an unknown or missing status', () => {
    expect(paymentPhase(null, NOW)).toBe('pending');
    expect(paymentPhase({ status: 'WHATEVER' as never }, NOW)).toBe('pending');
  });
});

describe('isTerminalPhase', () => {
  it('stops polling only once the outcome is known', () => {
    expect(isTerminalPhase('pending')).toBe(false);
    expect(isTerminalPhase('paid')).toBe(true);
    expect(isTerminalPhase('expired')).toBe(true);
    expect(isTerminalPhase('canceled')).toBe(true);
  });
});

describe('summarizePayments', () => {
  it('counts paid signups by phase and sums only confirmed revenue', () => {
    const rows = [
      { email: 'a@x', status: 'CONFIRMED', value: 5000 },
      { email: 'b@x', status: 'CONFIRMED', value: 2500 },
      { email: 'c@x', status: 'PEDING_PAYMENT', value: 5000, expires_at: '2026-11-01T13:00:00Z' },
      { email: 'd@x', status: 'PEDING_PAYMENT', value: 5000, expires_at: '2026-11-01T11:00:00Z' },
      { email: 'e@x', status: 'EXPIRED', value: 5000 },
      { email: 'f@x', status: 'CANCELED', value: 5000 },
      { email: 'g@x', status: 'CONFIRMED', value: 0 },
    ];
    expect(summarizePayments(rows, NOW)).toEqual({
      paid: 2, pending: 1, expired: 2, canceled: 1, refunded: 0, revenueCents: 7500,
    });
  });
});

describe('paymentStatusLabel', () => {
  it('labels every stored status for the admin list', () => {
    expect(paymentStatusLabel('PEDING_PAYMENT')).toBe('Pagamento pendente');
    expect(paymentStatusLabel('CONFIRMED')).toBe('Pago');
    expect(paymentStatusLabel('EXPIRED')).toBe('Expirado');
    expect(paymentStatusLabel('CANCELED')).toBe('Cancelado');
    expect(paymentStatusLabel('REFUND')).toBe('Reembolsado');
    expect(paymentStatusLabel(undefined)).toBe('—');
  });
});
