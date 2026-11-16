// REA-52: the admin's page of one user (/admin/usuarios/<id>). Pure: labels and the summary of each
// e-mail, read by the page and tested. The BFF answers only to an admin.

export const adminUserHref = (id: string | number) => `/admin/usuarios/${encodeURIComponent(String(id))}`;

const KIND_LABELS: Record<string, string> = {
  'login-code': 'Código de login',
  'signup-confirmation': 'Inscrição confirmada',
  'signup-confirmation-resend': 'Inscrição confirmada (reenvio)',
  'complete-registration': 'Conclua seu cadastro',
  'payment-pending': 'Pagamento pendente',
  certificate: 'Certificado',
  'management-invite': 'Convite de gestão',
  campaign: 'Campanha do evento',
  'age-review': 'Revisão de idade',
  'sw-form': 'Formulário Startup Weekend',
};

export function emailKindLabel(kind: string | null | undefined): string {
  if (!kind) return 'E-mail';
  return KIND_LABELS[kind] || kind;
}

export interface EmailEventLike {
  event: string;
  severity?: string | null;
}

/** One event of Mailgun's timeline, in Portuguese. */
export function emailEventLabel(event: EmailEventLike): string {
  switch (event.event) {
    case 'accepted': return 'Aceito pelo Mailgun';
    case 'delivered': return 'Entregue';
    case 'opened': return 'Aberto';
    case 'clicked': return 'Link clicado';
    case 'failed': return event.severity === 'permanent' ? 'Devolvido (falha permanente)' : 'Falha temporária (nova tentativa)';
    case 'complained': return 'Marcado como spam';
    case 'unsubscribed': return 'Descadastrou-se';
    default: return event.event;
  }
}

export type EmailOutcomeTone = 'good' | 'neutral' | 'warn' | 'bad';

export interface EmailLike {
  status?: string | null;
  error?: string | null;
  events?: EmailEventLike[] | null;
}

/**
 * The one badge of an e-mail: the most telling thing that happened, from Mailgun's events (spam >
 * bounced > clicked > opened > delivered > temporary failure) or, without events, whether Mailgun
 * took it. "Aberto" depends on the reader's client loading images: a missing one is not proof.
 */
export function emailOutcome(email: EmailLike): { label: string; tone: EmailOutcomeTone } {
  const events = email.events || [];
  const has = (name: string, severity?: string) =>
    events.some((e) => e.event === name && (!severity || e.severity === severity));
  if (has('complained')) return { label: 'Marcado como spam', tone: 'bad' };
  if (has('failed', 'permanent')) return { label: 'Devolvido', tone: 'bad' };
  if (has('unsubscribed')) return { label: 'Descadastrou-se', tone: 'warn' };
  if (has('clicked')) return { label: 'Clicado', tone: 'good' };
  if (has('opened')) return { label: 'Aberto', tone: 'good' };
  if (has('delivered')) return { label: 'Entregue', tone: 'good' };
  if (has('failed')) return { label: 'Falha temporária', tone: 'warn' };
  if (email.status === 'failed') return { label: 'Não enviado', tone: 'bad' };
  if (email.status === 'sending') return { label: 'Enviando', tone: 'neutral' };
  return { label: 'Enviado', tone: 'neutral' };
}

const AGE_REVIEW: Record<string, string> = {
  dob_requested: 'Data de nascimento pedida',
  dob_blocked: 'Desativado: sem data de nascimento',
  minor_blocked: 'Desativado: menor de idade',
};

export function ageReviewLabel(status: string | null | undefined): string | null {
  return status ? AGE_REVIEW[status] || status : null;
}

/** "16/11/2026 10:30" in Brasília time, or "—". */
export function formatDateTimeBR(value: string | null | undefined, timeZone = 'America/Sao_Paulo'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', '');
}

/** "17/05/1990" for a YYYY-MM-DD date, without a time zone shift. */
export function formatDateBR(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}
