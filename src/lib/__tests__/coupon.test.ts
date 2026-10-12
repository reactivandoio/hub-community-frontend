import { describe, expect, it } from 'vitest';
import {
  couponFormErrors,
  couponFormToInput,
  couponToForm,
  couponUsesLabel,
  couponValueLabel,
  isCouponLocked,
  normalizeCouponCode,
} from '../coupon';
import type { Coupon } from '../types';

const base: Coupon = {
  id: '7',
  code: 'PROMO10',
  discount_type: 'percentage',
  discount_percentage: 10,
  discount_value_cents: null,
  starts_at: null,
  expires_at: null,
  max_uses: 50,
  uses: 0,
  enabled: true,
  batches: [{ id: 'b1', batch_number: 1 }],
};

describe('coupon labels', () => {
  it('shows the value as a percentage or in reais', () => {
    expect(couponValueLabel(base)).toBe('10%');
    expect(couponValueLabel({ ...base, discount_type: 'fixed', discount_value_cents: 1050 })).toBe('R$ 10,50');
  });

  it('shows uses against the limit', () => {
    expect(couponUsesLabel({ ...base, uses: 3 })).toBe('3 / 50');
    expect(couponUsesLabel({ ...base, uses: null, max_uses: null })).toBe('0 / ilimitado');
  });

  it('locks type and value after the first use', () => {
    expect(isCouponLocked(base)).toBe(false);
    expect(isCouponLocked({ ...base, uses: 1 })).toBe(true);
  });

  it('normalizes the code', () => {
    expect(normalizeCouponCode(' promo 10 ')).toBe('PROMO10');
  });
});

describe('coupon form', () => {
  it('round-trips a fixed coupon typed in reais and saved in cents', () => {
    const form = couponToForm({ ...base, discount_type: 'fixed', discount_value_cents: 2550 });
    expect(form.discount_reais).toBe('25,50');
    const input = couponFormToInput({ ...form, discount_reais: '30,9' }, 'ev1', { locked: false });
    expect(input).toMatchObject({
      code: 'PROMO10',
      event: 'ev1',
      discount_type: 'fixed',
      discount_value_cents: 3090,
      discount_percentage: null,
      max_uses: 50,
      enabled: true,
      batches: ['b1'],
    });
  });

  it('sends empty dates and limit as null (period of the batch, unlimited)', () => {
    const input = couponFormToInput(
      { ...couponToForm(), code: 'x', discount_percentage: '15' },
      'ev1',
      { locked: false },
    );
    expect(input).toMatchObject({
      code: 'X',
      discount_type: 'percentage',
      discount_percentage: 15,
      discount_value_cents: null,
      starts_at: null,
      expires_at: null,
      max_uses: null,
      batches: [],
    });
  });

  it('converts the local datetime to ISO', () => {
    const input = couponFormToInput(
      { ...couponToForm(base), starts_at: '2026-11-01T08:00' },
      'ev1',
      { locked: false },
    );
    expect(input.starts_at).toBe(new Date('2026-11-01T08:00').toISOString());
  });

  it('leaves type and value out once the coupon is locked', () => {
    const input = couponFormToInput(couponToForm({ ...base, uses: 2 }), 'ev1', { locked: true });
    expect(input).not.toHaveProperty('discount_type');
    expect(input).not.toHaveProperty('discount_percentage');
    expect(input).not.toHaveProperty('discount_value_cents');
  });

  it('validates the fields', () => {
    const empty = couponToForm();
    expect(couponFormErrors(empty)).toMatchObject({ code: expect.any(String), discount_percentage: expect.any(String) });
    expect(couponFormErrors({ ...empty, code: 'A', discount_percentage: '101' }).discount_percentage).toBeDefined();
    expect(couponFormErrors({ ...empty, code: 'A', discount_percentage: '0' }).discount_percentage).toBeDefined();
    expect(couponFormErrors({ ...empty, code: 'A', discount_type: 'fixed', discount_reais: '0' }).discount_reais).toBeDefined();
    expect(
      couponFormErrors({ ...empty, code: 'A', discount_percentage: '10', starts_at: '2026-11-02T00:00', expires_at: '2026-11-01T00:00' })
        .expires_at,
    ).toBeDefined();
    expect(couponFormErrors({ ...empty, code: 'A', discount_percentage: '10', max_uses: '0' }).max_uses).toBeDefined();
    expect(couponFormErrors({ ...empty, code: 'A', discount_percentage: '10' })).toEqual({});
  });

  it('does not validate the locked value', () => {
    expect(couponFormErrors({ ...couponToForm(), code: 'A', discount_percentage: '' }, { locked: true })).toEqual({});
  });
});
