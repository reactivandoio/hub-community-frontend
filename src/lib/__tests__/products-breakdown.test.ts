import { describe, it, expect } from 'vitest';
import {
  batchOccupancy,
  batchPriceLabel,
  batchSoldLabel,
  productRevenueCents,
  revenueLabel,
} from '../products-breakdown';

const nbsp = (s: string) => s.replace(/ /g, ' ');

describe('batchPriceLabel', () => {
  it('reads the batch value as cents (REA-17: 1990 is R$ 19,90, not R$ 1.990,00)', () => {
    expect(nbsp(batchPriceLabel({ value: 1990 }))).toBe('R$ 19,90');
    expect(nbsp(batchPriceLabel({ value: 199000 }))).toBe('R$ 1.990,00');
  });

  it('calls a zero-value batch free', () => {
    expect(batchPriceLabel({ value: 0 })).toBe('Gratuito');
  });
});

describe('revenueLabel', () => {
  it('formats cents and shows a dash when nothing came in', () => {
    expect(nbsp(revenueLabel(1990))).toBe('R$ 19,90');
    expect(revenueLabel(0)).toBe('—');
    expect(revenueLabel(null)).toBe('—');
  });
});

describe('batchOccupancy', () => {
  it('is sold over capacity in percent', () => {
    expect(batchOccupancy({ sold_quantity: 1, max_quantity: 100 })).toBe(1);
    expect(batchOccupancy({ sold_quantity: 2, max_quantity: 3 })).toBe(67);
  });

  it('caps at 100 and is null without a limit', () => {
    expect(batchOccupancy({ sold_quantity: 12, max_quantity: 10 })).toBe(100);
    expect(batchOccupancy({ sold_quantity: 5, max_quantity: 0 })).toBeNull();
  });
});

describe('batchSoldLabel', () => {
  it('reads sold over capacity, or sold alone without a limit', () => {
    expect(batchSoldLabel({ sold_quantity: 1, max_quantity: 100 })).toBe('1 de 100 vendido');
    expect(batchSoldLabel({ sold_quantity: 3, max_quantity: 100 })).toBe('3 de 100 vendidos');
    expect(batchSoldLabel({ sold_quantity: 3, max_quantity: 0 })).toBe('3 vendidos');
  });
});

describe('productRevenueCents', () => {
  it('sums the batch revenues in cents', () => {
    expect(productRevenueCents({ batches: [{ revenue: 1990 }, { revenue: 995 }] as never })).toBe(2985);
  });
});
