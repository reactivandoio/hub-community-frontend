import { formatCents } from './money';
import type { BatchAnalytics, ProductAnalytics } from './types';

// The analytics "Produtos e Lotes" block. Batch `value` and `revenue` come from the
// BFF in cents (REA-6); every money figure goes through money.ts.

/** "R$ 19,90", or "Gratuito" for a free batch. */
export function batchPriceLabel(batch: Pick<BatchAnalytics, 'value'>): string {
  return Number(batch.value) > 0 ? formatCents(batch.value) : 'Gratuito';
}

/** "R$ 19,90", or "—" when nothing came in. */
export function revenueLabel(cents: number | null | undefined): string {
  return Number(cents) > 0 ? formatCents(cents) : '—';
}

/** Sold over capacity in percent (0–100, rounded), or null without a capacity limit. */
export function batchOccupancy(batch: Pick<BatchAnalytics, 'sold_quantity' | 'max_quantity'>): number | null {
  const max = Number(batch.max_quantity);
  if (!Number.isFinite(max) || max <= 0) return null;
  const sold = Math.max(0, Number(batch.sold_quantity) || 0);
  return Math.min(100, Math.round((sold / max) * 100));
}

/** "1 de 100 vendidos", or "1 vendido" when the batch has no limit. */
export function batchSoldLabel(batch: Pick<BatchAnalytics, 'sold_quantity' | 'max_quantity'>): string {
  const sold = Number(batch.sold_quantity) || 0;
  if (batchOccupancy(batch) === null) return `${sold} ${sold === 1 ? 'vendido' : 'vendidos'}`;
  return `${sold} de ${batch.max_quantity} ${sold === 1 ? 'vendido' : 'vendidos'}`;
}

export function productRevenueCents(product: Pick<ProductAnalytics, 'batches'>): number {
  return product.batches.reduce((sum, batch) => sum + (Number(batch.revenue) || 0), 0);
}
