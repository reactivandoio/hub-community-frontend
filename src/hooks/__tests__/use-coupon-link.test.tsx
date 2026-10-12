import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCouponLink } from '../use-coupon-link';
import { readPendingCoupon, savePendingCoupon } from '@/lib/coupon-link';

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/events/meetup');
});

describe('useCouponLink', () => {
  it('reads the coupon of the fragment and keeps it for the event', () => {
    window.history.replaceState(null, '', '/events/meetup#cupom=promo10');
    const { result } = renderHook(() => useCouponLink('meetup'));
    expect(result.current.code).toBe('PROMO10');
    expect(readPendingCoupon('meetup')).toBe('PROMO10');
  });

  it('falls back to the kept coupon when the fragment is gone (back from the login)', () => {
    savePendingCoupon('meetup', 'PROMO10');
    const { result } = renderHook(() => useCouponLink('meetup'));
    expect(result.current.code).toBe('PROMO10');
  });

  it('has no coupon with another fragment, and does not touch it', () => {
    window.history.replaceState(null, '', '/events/meetup#agenda');
    const { result } = renderHook(() => useCouponLink('meetup'));
    expect(result.current.code).toBeNull();
    act(() => result.current.clear());
    expect(window.location.hash).toBe('#agenda');
  });

  it('a newer link replaces the kept coupon', () => {
    savePendingCoupon('meetup', 'OLD');
    window.history.replaceState(null, '', '/events/meetup#cupom=NEW');
    const { result } = renderHook(() => useCouponLink('meetup'));
    expect(result.current.code).toBe('NEW');
    expect(readPendingCoupon('meetup')).toBe('NEW');
  });

  it('clear forgets the coupon and takes it out of the address bar', () => {
    window.history.replaceState(null, '', '/events/meetup?x=1#cupom=PROMO10');
    const { result } = renderHook(() => useCouponLink('meetup'));
    act(() => result.current.clear());
    expect(result.current.code).toBeNull();
    expect(readPendingCoupon('meetup')).toBeNull();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?x=1');
  });
});
