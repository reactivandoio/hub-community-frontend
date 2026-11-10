import { describe, expect, it } from 'vitest';

import { paidSignupsSubtitle, participantsDescription, signupPaymentView } from '../paid-signups';

describe('paidSignupsSubtitle', () => {
  it('shows the money and the pending charges apart from the count', () => {
    expect(paidSignupsSubtitle(20000, 2)).toBe('R$ 200,00 arrecadados · +2 pendentes');
  });

  it('uses the singular for one pending charge', () => {
    expect(paidSignupsSubtitle(5000, 1)).toBe('R$ 50,00 arrecadados · +1 pendente');
  });

  it('shows only the pending ones when nothing was paid yet', () => {
    expect(paidSignupsSubtitle(0, 3)).toBe('+3 pendentes');
  });

  it('is empty without money nor pending, or on an older BFF without the field', () => {
    expect(paidSignupsSubtitle(0, 0)).toBeUndefined();
    expect(paidSignupsSubtitle(0, undefined)).toBeUndefined();
    expect(paidSignupsSubtitle(1000, null)).toBe('R$ 10,00 arrecadados');
  });
});

describe('signupPaymentView (REA-28)', () => {
  it('shows what a confirmed signup paid and its coupon', () => {
    expect(signupPaymentView({ payment_status: 'CONFIRMED', paid_cents: 1500, coupon_code: 'MEETUP25' })).toEqual({
      status: 'Pago',
      tone: 'paid',
      paid: 'R$ 15,00',
      coupon: 'MEETUP25',
    });
  });

  it('never shows a pending charge as paid', () => {
    expect(signupPaymentView({ payment_status: 'PEDING_PAYMENT', paid_cents: null })).toMatchObject({
      status: 'Pendente',
      paid: null,
    });
  });

  it('shows an expired one as Expirado', () => {
    expect(signupPaymentView({ payment_status: 'EXPIRED', coupon_code: 'X' })).toEqual({
      status: 'Expirado',
      tone: 'lost',
      paid: null,
      coupon: 'X',
    });
  });

  it('shows canceled and refunded ones', () => {
    expect(signupPaymentView({ payment_status: 'CANCELED' }).status).toBe('Cancelado');
    expect(signupPaymentView({ payment_status: 'REFUND' }).status).toBe('Reembolsado');
  });

  it('shows a free signup as Gratuito with no value, with or without payment', () => {
    expect(signupPaymentView({ payment_status: null })).toMatchObject({ status: 'Gratuito', paid: null });
    expect(signupPaymentView({})).toMatchObject({ status: 'Gratuito', paid: null, coupon: null });
    expect(signupPaymentView({ payment_status: 'CONFIRMED', paid_cents: null, coupon_code: 'FREE' })).toMatchObject({
      status: 'Gratuito',
      paid: null,
      coupon: 'FREE',
    });
  });
});

describe('participantsDescription', () => {
  it('says how many listed signups are out of the total', () => {
    expect(participantsDescription(14, 12)).toBe('14 inscrições · 2 expiradas ou canceladas');
    expect(participantsDescription(13, 12)).toBe('13 inscrições · 1 expirada ou cancelada');
  });

  it('is just the count when nobody was dropped', () => {
    expect(participantsDescription(12, 12)).toBe('12 inscrições');
    expect(participantsDescription(1, 1)).toBe('1 inscrição');
  });
});
