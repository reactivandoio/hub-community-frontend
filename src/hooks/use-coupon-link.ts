'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  clearPendingCoupon,
  couponFromHash,
  readPendingCoupon,
  savePendingCoupon,
} from '@/lib/coupon-link';

interface CouponLink {
  /** Coupon that came in the link (#cupom=CODE) or was kept from it; null without one. */
  code: string | null;
  /** Forgets the coupon: storage and the fragment in the address bar. */
  clear: () => void;
}

/**
 * Coupon of a ready-made link (REA-18) for one event. Reads the URL fragment,
 * keeps the code in the browser so it survives login and the redirect back, and
 * falls back to the kept one when the fragment is gone.
 */
export function useCouponLink(eventKey: string): CouponLink {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const fromHash = couponFromHash(window.location.hash);
      if (fromHash) savePendingCoupon(eventKey, fromHash);
      setCode(fromHash || readPendingCoupon(eventKey));
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [eventKey]);

  const clear = useCallback(() => {
    clearPendingCoupon(eventKey);
    // Only our fragment goes away: an anchor or a tab stays where it is.
    if (couponFromHash(window.location.hash)) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
    setCode(null);
  }, [eventKey]);

  return { code, clear };
}
