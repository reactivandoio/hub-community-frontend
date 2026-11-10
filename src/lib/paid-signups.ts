import { formatCents } from './money';

/**
 * Subtitle of the "Inscrições Pagas" card: what was paid and the charges still open,
 * e.g. "R$ 200,00 arrecadados · +2 pendentes". A pending charge is not a paid signup
 * (REA-27), so it shows here and never in the count.
 */
export function paidSignupsSubtitle(
  revenueCents: number,
  pending: number | null | undefined,
): string | undefined {
  const parts: string[] = [];
  if (revenueCents > 0) parts.push(`${formatCents(revenueCents)} arrecadados`);
  if (pending && pending > 0) parts.push(`+${pending} pendente${pending === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : undefined;
}
