import type { PaymentStatus } from './types';

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
