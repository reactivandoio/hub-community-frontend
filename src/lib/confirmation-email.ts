// REA-50: the "Inscrição confirmada" e-mail of a signup in the participants list. Pure: the row and
// the resend dialog read it. The BFF checks everything again (role, status, one resend a minute).

import { formatApprovalDate } from '@/lib/manual-approval';

export interface ConfirmationEmailLike {
  signup_id?: string | null;
  email?: string | null;
  /** null without payment (free, imported, added by hand). */
  payment_status?: string | null;
  confirmation_email_status?: string | null;
  confirmation_email_at?: string | null;
  confirmation_email_error?: string | null;
  confirmation_resent_at?: string | null;
}

/** Seconds the button stays off after a resend (same as the BFF). */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Whether "Reenviar e-mail" shows on a row: confirmed signups only — without payment (free,
 * imported, manual) or CONFIRMED (paid or approved by hand). Never pending, expired, canceled or
 * refunded.
 */
export function canResendConfirmation(signup: ConfirmationEmailLike): boolean {
  if (!signup.signup_id || !signup.email) return false;
  return !signup.payment_status || signup.payment_status === 'CONFIRMED';
}

export function confirmationEmailFailed(signup: ConfirmationEmailLike): boolean {
  return signup.confirmation_email_status === 'failed';
}

/** "Reenviado em 15/11/2026 10:30", or "" when it never was. */
export function resentNote(resentAt: string | null | undefined, timeZone = 'America/Sao_Paulo'): string {
  const at = formatApprovalDate(resentAt, timeZone);
  return at ? `Reenviado em ${at}` : '';
}

/** Seconds left before another resend (0 = now). */
export function resendWait(resentAt: string | null | undefined, now: Date = new Date()): number {
  if (!resentAt) return 0;
  const elapsed = (now.getTime() - new Date(resentAt).getTime()) / 1000;
  if (Number.isNaN(elapsed)) return 0;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}
