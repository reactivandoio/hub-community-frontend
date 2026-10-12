import { reaisToCents } from '@/lib/money';
import type { OpaPingouConnection } from '@/lib/types';

/**
 * REA-12: the Opa Pingou account that charges the paid lots of an event. The key typed in the
 * admin goes once to the BFF and is never returned; the screen only shows the company, the
 * masked CNPJ and the last 4 characters of the key.
 */

export const OPAPINGOU_SIGNUP_URL = 'https://opapingou.com.br/cadastro';
export const OPAPINGOU_KEYS_URL = 'https://opapingou.com.br/app/chaves';

/** Scopes the key needs, with the labels the Opa Pingou shows when creating it. */
export const REQUIRED_SCOPES: ReadonlyArray<{ scope: string; label: string }> = [
  { scope: 'profile:read', label: 'Ler o perfil e a empresa da conta' },
  { scope: 'charges:read', label: 'Ler cobranças e prever o roteamento' },
  { scope: 'charges:write', label: 'Criar, cancelar e simular cobranças' },
  { scope: 'webhooks:read', label: 'Ler endpoints e entregas de webhook' },
  { scope: 'webhooks:write', label: 'Gerenciar endpoints e reenviar entregas de webhook' },
];

/** Same rule as the Eventando: opk_live_ (or opk_test_ outside production) and the token. */
export function looksLikeOpaPingouKey(value: string): boolean {
  return /^opk_(live|test)_[A-Za-z0-9_-]{20,200}$/.test(value.trim());
}

// "Empresa X LTDA · CNPJ **.***.***/0001-90 · chave …abcd"
export function connectionLabel(c: OpaPingouConnection): string {
  return [
    c.companyName || 'Conta Opa Pingou',
    c.companyDocument ? `CNPJ ${c.companyDocument}` : null,
    c.keyLast4 ? `chave …${c.keyLast4}` : null,
    c.testMode ? 'teste' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

interface GraphQLLikeError {
  message?: string;
  graphQLErrors?: ReadonlyArray<{ message?: string; extensions?: Record<string, unknown> }>;
}

/** The message the BFF wrote for the person, plus the permissions the key is missing. */
export function opaPingouErrorMessage(error: unknown): string {
  const gql = (error as GraphQLLikeError)?.graphQLErrors?.[0];
  const base =
    gql?.message || 'Não foi possível concluir agora. Tente de novo em instantes.';
  const missing = gql?.extensions?.missing;
  if (Array.isArray(missing) && missing.length > 0) {
    const labels = missing.map(
      (scope) => REQUIRED_SCOPES.find((s) => s.scope === scope)?.label || String(scope),
    );
    return `${base} Falta: ${labels.join('; ')}.`;
  }
  return base;
}

/** Shown when a paid lot is saved without an account (same text the BFF answers). */
export const ACCOUNT_REQUIRED_MESSAGE =
  'Para criar lote pago, conecte a conta Opa Pingou do evento (bloco "Conta Opa Pingou do evento", na aba de produtos e lotes). Lotes gratuitos não precisam.';

interface FormBatchLike { value?: number | string | null; enabled?: boolean }
interface FormProductLike { enabled?: boolean; batches?: FormBatchLike[] }

/** Any enabled lot with a price (form values, in reais) inside an enabled product. */
export function hasPaidBatch(products: FormProductLike[] | null | undefined): boolean {
  return (products || []).some(
    (p) => p && p.enabled !== false && (p.batches || []).some((b) => b && b.enabled !== false && reaisToCents(b.value) > 0),
  );
}

/** The BFF refused the lots because the event has no account. */
export function isAccountRequiredError(error: unknown): boolean {
  return Boolean(
    (error as GraphQLLikeError)?.graphQLErrors?.some((e) => e.extensions?.code === 'OPAPINGOU_ACCOUNT_REQUIRED'),
  );
}
