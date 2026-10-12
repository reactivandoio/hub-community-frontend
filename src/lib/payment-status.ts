import type { PaymentStatus } from './types';
import { formatCents } from './money';

export type PaymentPhase = 'pending' | 'paid' | 'expired' | 'canceled' | 'refunded';

interface PaymentLike {
  status?: PaymentStatus | string | null;
  expires_at?: string | null;
}

/**
 * What the participant sees for a paid signup. The webhook is the source of truth;
 * a pending charge past `expires_at` already reads as expired so the page does not
 * keep showing a Pix code that can no longer be paid.
 */
export function paymentPhase(payment: PaymentLike | null | undefined, now: Date = new Date()): PaymentPhase {
  switch (payment?.status) {
    case 'CONFIRMED':
      return 'paid';
    case 'EXPIRED':
      return 'expired';
    case 'CANCELED':
      return 'canceled';
    case 'REFUND':
      return 'refunded';
    default:
      if (payment?.expires_at && new Date(payment.expires_at).getTime() <= now.getTime()) {
        return 'expired';
      }
      return 'pending';
  }
}

export function isTerminalPhase(phase: PaymentPhase): boolean {
  return phase !== 'pending';
}

export interface EventPaymentRow {
  email: string;
  name?: string | null;
  status: PaymentStatus | string;
  value?: number | null;
  expires_at?: string | null;
}

export interface PaymentSummary {
  paid: number;
  pending: number;
  expired: number;
  canceled: number;
  refunded: number;
  revenueCents: number;
}

/** Paid signups only (free ones are CONFIRMED with value 0 and are not counted). */
export function summarizePayments(rows: EventPaymentRow[], now: Date = new Date()): PaymentSummary {
  const summary: PaymentSummary = { paid: 0, pending: 0, expired: 0, canceled: 0, refunded: 0, revenueCents: 0 };
  for (const row of rows) {
    const value = Number(row.value) || 0;
    if (value <= 0) continue;
    const phase = paymentPhase(row, now);
    if (phase === 'paid') {
      summary.paid += 1;
      summary.revenueCents += value;
    } else {
      summary[phase] += 1;
    }
  }
  return summary;
}

const LABELS: Record<string, string> = {
  PEDING_PAYMENT: 'Pagamento pendente',
  CONFIRMED: 'Pago',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado',
  REFUND: 'Reembolsado',
};

export function paymentStatusLabel(status: PaymentStatus | string | null | undefined): string {
  return (status && LABELS[status]) || '—';
}

/** "mm:ss" left on the charge. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

const DEFAULT_REFUND_TEXT = 'Precisa de reembolso? Fale com o suporte pelo WhatsApp.';

/**
 * Refunds are manual, through support on WhatsApp. Text and number come from the
 * server (REFUND_SUPPORT_TEXT / REFUND_SUPPORT_WHATSAPP); without a number there
 * is nothing to show.
 */
export function refundContact(
  support: { text?: string | null; whatsapp?: string | null } | null | undefined,
): { text: string; href: string } | null {
  const digits = String(support?.whatsapp || '').replace(/\D/g, '');
  if (!digits) return null;
  return { text: support?.text?.trim() || DEFAULT_REFUND_TEXT, href: `https://wa.me/${digits}` };
}

export function discountLabel(kind: string | null | undefined): string | null {
  if (kind === 'coupon') return 'Desconto do cupom';
  if (kind === 'student') return 'Meia-entrada';
  return null;
}

/** Coupon and half price chosen together: which one the server kept (half price wins a tie). */
export function halfPriceWinner(kind: string | null | undefined): string | null {
  if (kind === 'student') return 'Vale a meia-entrada: o desconto dela é maior ou igual ao do cupom, que não será usado.';
  if (kind === 'coupon') return 'Vale o cupom: o desconto dele é maior que o da meia-entrada.';
  return null;
}

/** Shown when the server raised a tiny discounted price to the provider's minimum. */
export function minChargeNotice(cents: number | null | undefined): string {
  return `O valor foi ajustado para o mínimo de cobrança: ${formatCents(cents)}.`;
}

export function isPaymentLinkUnavailable(message: string | null | undefined): boolean {
  return /link\s+(de pagamento\s+)?indispon[ií]vel|PAYMENT_LINK_UNAVAILABLE/i.test(message || '');
}
