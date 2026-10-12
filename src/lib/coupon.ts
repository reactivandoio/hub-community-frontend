import { format } from 'date-fns';

import { formatCents, reaisToCents } from './money';
import type { Coupon, CouponDiscountType, CouponInput } from './types';

// Admin coupon form (REA-6). Fixed discounts are typed in reais and stored in
// cents, like batch prices. Type and value lock after the first use; the
// Eventando enforces it, the form only mirrors it.

export interface CouponFormValues {
  code: string;
  discount_type: CouponDiscountType;
  discount_percentage: string;
  discount_reais: string;
  starts_at: string; // datetime-local, empty = the batch's period
  expires_at: string;
  max_uses: string; // empty = unlimited
  batch_ids: string[]; // empty = every batch
  enabled: boolean;
}

export type CouponFormErrors = Partial<Record<keyof CouponFormValues, string>>;

export function normalizeCouponCode(code: string): string {
  return String(code || '').replace(/\s+/g, '').toUpperCase();
}

export function isCouponLocked(coupon: Pick<Coupon, 'uses'> | null | undefined): boolean {
  return Number(coupon?.uses) > 0;
}

export function couponValueLabel(coupon: Coupon): string {
  if (coupon.discount_type === 'fixed') return formatCents(coupon.discount_value_cents);
  return `${coupon.discount_percentage ?? 0}%`;
}

export function couponUsesLabel(coupon: Coupon): string {
  const uses = Number(coupon.uses) || 0;
  return `${uses} / ${coupon.max_uses ? coupon.max_uses : 'ilimitado'}`;
}

const toLocalInput = (iso: string | null | undefined): string =>
  iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '';

const toIso = (local: string): string | null => (local ? new Date(local).toISOString() : null);

export function couponToForm(coupon?: Coupon | null): CouponFormValues {
  const cents = Number(coupon?.discount_value_cents) || 0;
  return {
    code: coupon?.code || '',
    discount_type: coupon?.discount_type === 'fixed' ? 'fixed' : 'percentage',
    discount_percentage:
      coupon?.discount_percentage !== null && coupon?.discount_percentage !== undefined
        ? String(coupon.discount_percentage)
        : '',
    discount_reais: cents ? (cents / 100).toFixed(2).replace('.', ',') : '',
    starts_at: toLocalInput(coupon?.starts_at),
    expires_at: toLocalInput(coupon?.expires_at),
    max_uses: coupon?.max_uses ? String(coupon.max_uses) : '',
    batch_ids: (coupon?.batches || []).map((b) => String(b.id)),
    enabled: coupon?.enabled !== false,
  };
}

export function couponFormErrors(
  values: CouponFormValues,
  { locked = false }: { locked?: boolean } = {},
): CouponFormErrors {
  const errors: CouponFormErrors = {};
  if (!normalizeCouponCode(values.code)) errors.code = 'Informe o código.';
  if (!locked) {
    if (values.discount_type === 'percentage') {
      const pct = Number(values.discount_percentage);
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
        errors.discount_percentage = 'Use um percentual inteiro de 1 a 100.';
      }
    } else if (reaisToCents(values.discount_reais) <= 0) {
      errors.discount_reais = 'Informe um valor maior que zero.';
    }
  }
  if (values.starts_at && values.expires_at && new Date(values.expires_at) <= new Date(values.starts_at)) {
    errors.expires_at = 'O fim precisa ser depois do início.';
  }
  if (values.max_uses) {
    const max = Number(values.max_uses);
    if (!Number.isInteger(max) || max < 1) errors.max_uses = 'Use um número inteiro maior que zero, ou deixe vazio.';
  }
  return errors;
}

export function couponFormToInput(
  values: CouponFormValues,
  eventId: string,
  { locked }: { locked: boolean },
): CouponInput {
  const input: CouponInput = {
    code: normalizeCouponCode(values.code),
    event: eventId,
    starts_at: toIso(values.starts_at),
    expires_at: toIso(values.expires_at),
    max_uses: values.max_uses ? Number(values.max_uses) : null,
    enabled: values.enabled,
    batches: values.batch_ids,
  };
  if (locked) return input;
  const fixed = values.discount_type === 'fixed';
  return {
    ...input,
    discount_type: values.discount_type,
    discount_percentage: fixed ? null : Number(values.discount_percentage),
    discount_value_cents: fixed ? reaisToCents(values.discount_reais) : null,
  };
}
