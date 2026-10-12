import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearPendingCoupon,
  couponFromHash,
  couponHash,
  couponLink,
  pendingCouponHash,
  readPendingCoupon,
  savePendingCoupon,
} from '../coupon-link';

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('couponHash / couponLink', () => {
  it('builds the event URL with the code in the fragment', () => {
    expect(couponLink('https://hubcommunity.io', 'meetup', 'PROMO10')).toBe(
      'https://hubcommunity.io/events/meetup#cupom=PROMO10',
    );
    expect(couponLink('https://hubcommunity.io/', 'meetup', 'promo10')).toBe(
      'https://hubcommunity.io/events/meetup#cupom=PROMO10',
    );
  });

  it('encodes the code', () => {
    expect(couponHash('50%&OFF')).toBe('#cupom=50%25%26OFF');
    expect(couponFromHash(couponHash('50%&OFF'))).toBe('50%&OFF');
  });

  it('has no fragment without a code', () => {
    expect(couponHash('')).toBe('');
    expect(couponHash(null)).toBe('');
  });
});

describe('couponFromHash', () => {
  it('reads the code in any case, with or without the #', () => {
    expect(couponFromHash('#cupom=PROMO10')).toBe('PROMO10');
    expect(couponFromHash('#cupom=promo10')).toBe('PROMO10');
    expect(couponFromHash('#CUPOM=Promo10')).toBe('PROMO10');
    expect(couponFromHash('cupom=promo10')).toBe('PROMO10');
  });

  it('finds the code next to other fragment parameters', () => {
    expect(couponFromHash('#tab=agenda&cupom=vip')).toBe('VIP');
  });

  it('leaves other uses of the fragment alone', () => {
    expect(couponFromHash('#products')).toBeNull();
    expect(couponFromHash('#agenda')).toBeNull();
    expect(couponFromHash('#cupom')).toBeNull();
    expect(couponFromHash('#cupom=')).toBeNull();
    expect(couponFromHash('#cupom=%20')).toBeNull();
    expect(couponFromHash('')).toBeNull();
    expect(couponFromHash(undefined)).toBeNull();
  });

  it('refuses an absurdly long code', () => {
    expect(couponFromHash(`#cupom=${'A'.repeat(65)}`)).toBeNull();
  });
});

describe('pending coupon', () => {
  it('keeps the code per event', () => {
    savePendingCoupon('meetup', 'PROMO10');
    expect(readPendingCoupon('meetup')).toBe('PROMO10');
    expect(readPendingCoupon('outro-evento')).toBeNull();
  });

  it('expires after a day', () => {
    savePendingCoupon('meetup', 'PROMO10', 1000);
    expect(readPendingCoupon('meetup', 1000 + DAY - 1)).toBe('PROMO10');
    expect(readPendingCoupon('meetup', 1000 + DAY + 1)).toBeNull();
    expect(window.localStorage.getItem('pending_coupon:meetup')).toBeNull();
  });

  it('ignores a broken entry', () => {
    window.localStorage.setItem('pending_coupon:meetup', 'not json');
    expect(readPendingCoupon('meetup')).toBeNull();
  });

  it('clears', () => {
    savePendingCoupon('meetup', 'PROMO10');
    clearPendingCoupon('meetup');
    expect(readPendingCoupon('meetup')).toBeNull();
  });

  it('pendingCouponHash prefers the address bar, then the kept code', () => {
    expect(pendingCouponHash('meetup')).toBe('');
    savePendingCoupon('meetup', 'KEPT');
    expect(pendingCouponHash('meetup')).toBe('#cupom=KEPT');
    window.history.replaceState(null, '', '/events/meetup#cupom=url');
    expect(pendingCouponHash('meetup')).toBe('#cupom=URL');
  });
});
