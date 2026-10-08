import type { EventBatchesResponse } from '@/lib/types';

type Products = NonNullable<EventBatchesResponse['eventBySlugOrId']>['products'];

/**
 * The batch a walk-in is signed up on: the lowest-numbered enabled batch of an
 * enabled product that is listed on the event page (hidden products, such as
 * import-only ones, are skipped). Null when the event has none.
 */
export function activeBatchId(products: Products | null | undefined): string | null {
  const candidates = (products || [])
    .filter((p) => p.enabled && p.can_be_listed !== false)
    .flatMap((p) => (p.batches || []).filter((b) => b.enabled))
    .sort((a, b) => a.batch_number - b.batch_number);
  return candidates.length > 0 ? String(candidates[0].id) : null;
}
