import type { AiTextGeneration, AiTextGenerationStatus } from '@/lib/types';

// REA-51: "Gerar texto com IA" on the e-mail marketing page and the AI settings page. Pure rules;
// the termhub calls and the token live only in the BFF (services/termhub).

export const AI_SETTINGS_PATH = '/admin/configuracoes/ia';
/** How often the page asks the BFF how the run is going. */
export const GENERATION_POLL_MS = 1500;
export const MAX_AI_INSTRUCTIONS = 500;
/** What is shown of the text the model is writing (its tail). */
const PREVIEW_TAIL = 600;

export const isGenerationActive = (status: AiTextGenerationStatus | null | undefined) =>
  status === 'queued' || status === 'running';

export const GENERATION_STATUS_LABELS: Record<AiTextGenerationStatus, string> = {
  queued: 'Na fila do termhub…',
  running: 'Escrevendo o texto…',
  succeeded: 'Rascunho pronto',
  failed: 'A geração falhou',
  cancelled: 'Geração cancelada',
};

/** The settings page, coming back to `returnTo` after saving. */
export const aiSettingsHref = (returnTo?: string | null) => {
  const back = safeReturnTo(returnTo);
  return back ? `${AI_SETTINGS_PATH}?voltar=${encodeURIComponent(back)}` : AI_SETTINGS_PATH;
};

/** Only a path inside the admin (no other site, no protocol-relative URL). */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/admin') || value.startsWith('//') || /[\\\s]/.test(value)) return null;
  return value;
}

// Errors that the AI settings page fixes (no token, refused token, wrong project).
const SETUP_CODES = new Set([
  'TERMHUB_NOT_CONFIGURED',
  'TERMHUB_TOKEN_INVALID',
  'TERMHUB_TOKEN_SCOPE',
  'TERMHUB_TOKEN_UNREADABLE',
  'TERMHUB_NOT_FOUND',
]);

export const needsSetup = (code: string | null | undefined) => !!code && SETUP_CODES.has(code);

interface GraphQLErrorLike {
  graphQLErrors?: ReadonlyArray<{ message?: string; extensions?: Record<string, unknown> }>;
  message?: string;
}

/** The BFF's code and pt-BR message of a failed mutation. */
export function readError(error: unknown): { code: string | null; message: string; retryAfter: number | null } {
  const first = (error as GraphQLErrorLike)?.graphQLErrors?.[0];
  const code = typeof first?.extensions?.code === 'string' ? first.extensions.code : null;
  const retry = Number(first?.extensions?.retryAfter);
  return {
    code,
    message: first?.message || (error as GraphQLErrorLike)?.message || 'Não foi possível falar com o servidor.',
    retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null,
  };
}

/** The end of what the model has written so far, for the progress box. */
export function previewTail(preview: string | null | undefined): string {
  const text = (preview || '').trim();
  return text.length > PREVIEW_TAIL ? `…${text.slice(-PREVIEW_TAIL)}` : text;
}

/** A succeeded generation with a subject: what "Usar este texto" puts in the form. */
export function draftOf(generation: Pick<AiTextGeneration, 'status' | 'subject' | 'message'> | null | undefined) {
  if (!generation || generation.status !== 'succeeded' || !generation.subject) return null;
  return { subject: generation.subject, message: generation.message || '' };
}

/** A random id per click: repeating the request returns the same generation (idempotency). */
export function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** "agora há pouco" / "15/11/2026 14:03" for the settings page. */
export function formatVerifiedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  });
}
