// Manual approval of a paid signup, without a charge (REA-34). Pure: the dialog and the
// participants list read it. The BFF re-checks everything (admin only, status rules).

export interface ApprovableSignupLike {
  signup_id?: string | null;
  payment_status?: string | null;
  manual_approved?: boolean | null;
}

/** Statuses an admin may approve by hand. REFUND never; CONFIRMED is already in. */
const APPROVABLE = new Set(['PEDING_PAYMENT', 'EXPIRED', 'CANCELED']);

/**
 * Whether the "Aprovar" button shows on a row. A signup without payment (imported or
 * added by hand) already holds its place and is not approvable.
 */
export function canApproveSignup(signup: ApprovableSignupLike): boolean {
  if (!signup.signup_id || signup.manual_approved) return false;
  return !!signup.payment_status && APPROVABLE.has(signup.payment_status);
}

export interface ManualApprovalLike {
  manual_approved_by?: string | null;
  manual_approved_at?: string | null;
}

/** "por Pedro em 10/11/2026 12:30" (Brasília time); empty when nothing is known. */
export function manualApprovalNote(signup: ManualApprovalLike, timeZone = 'America/Sao_Paulo'): string {
  const parts: string[] = [];
  const by = signup.manual_approved_by?.trim();
  if (by) parts.push(`por ${by}`);
  const at = formatApprovalDate(signup.manual_approved_at, timeZone);
  if (at) parts.push(`em ${at}`);
  return parts.join(' ');
}

/** "10/11/2026 12:30", or "" for a missing or invalid date. */
export function formatApprovalDate(value: string | null | undefined, timeZone = 'America/Sao_Paulo'): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date
    .toLocaleString('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', '');
}

const WARNINGS: Record<string, string> = {
  BATCH_FULL: 'O lote está lotado: com esta aprovação ele passa do limite.',
  EVENT_FULL: 'O evento está lotado: com esta aprovação ele passa do limite de vagas.',
  COUPON_EXHAUSTED: 'O cupom usado já está esgotado: com esta aprovação ele passa do limite de usos.',
};

export function approvalWarningLabel(code: string): string {
  return WARNINGS[code] || code;
}

const REASONS: Record<string, string> = {
  NOT_FOUND: 'Inscrição não encontrada neste evento.',
  NO_PAYMENT: 'Inscrição sem pagamento: ela já ocupa a vaga.',
  ALREADY_CONFIRMED: 'Esta inscrição já está confirmada.',
  REFUNDED: 'O pagamento foi reembolsado: esta inscrição não pode ser aprovada.',
  ALREADY_APPROVED: 'Esta inscrição já foi aprovada manualmente.',
};

export function approvalReasonLabel(reason: string | null | undefined): string {
  return (reason && REASONS[reason]) || 'Esta inscrição não pode ser aprovada.';
}
