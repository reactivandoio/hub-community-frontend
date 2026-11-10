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

export interface SignupPaymentLike {
  payment_status?: string | null;
  paid_cents?: number | null;
  coupon_code?: string | null;
}

export type SignupPaymentTone = 'paid' | 'free' | 'pending' | 'lost';

export interface SignupPaymentView {
  /** "Pago", "Gratuito", "Pendente", "Expirado", "Cancelado", "Reembolsado". */
  status: string;
  tone: SignupPaymentTone;
  /** What was paid, formatted; null when free or not paid (a pending charge is not paid). */
  paid: string | null;
  coupon: string | null;
}

const STATUS: Record<string, { status: string; tone: SignupPaymentTone }> = {
  PEDING_PAYMENT: { status: 'Pendente', tone: 'pending' },
  EXPIRED: { status: 'Expirado', tone: 'lost' },
  CANCELED: { status: 'Cancelado', tone: 'lost' },
  REFUND: { status: 'Reembolsado', tone: 'lost' },
};

/**
 * The payment of one row of the participants list (REA-28). The BFF sends paid_cents
 * only for a confirmed payment with a value, and the status already reads EXPIRED for
 * a pending charge past its deadline.
 */
export function signupPaymentView(signup: SignupPaymentLike): SignupPaymentView {
  const coupon = signup.coupon_code?.trim() || null;
  const paidCents = Number(signup.paid_cents) || 0;
  if (paidCents > 0) return { status: 'Pago', tone: 'paid', paid: formatCents(paidCents), coupon };
  const known = signup.payment_status ? STATUS[signup.payment_status] : undefined;
  if (known) return { ...known, paid: null, coupon };
  // No payment, or a confirmed one of zero (free batch, or a coupon that took it all).
  return { status: 'Gratuito', tone: 'free', paid: null, coupon };
}
