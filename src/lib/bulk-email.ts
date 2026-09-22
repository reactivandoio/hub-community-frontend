import type { BulkEmailResponse } from '@/lib/types';

export interface BulkEmailToast {
  variant?: 'destructive';
  title: string;
  description?: string;
}

const FALLBACK = 'Não foi possível enfileirar os emails.';

/** Toast for `sendImportedSignupConfirmations`: queued count, or the error. */
export function bulkEmailToast(result: BulkEmailResponse | null | undefined): BulkEmailToast {
  if (result?.success) {
    const n = result.queued_count;
    return { title: `${n} ${n === 1 ? 'email' : 'emails'} na fila` };
  }
  return {
    variant: 'destructive',
    title: 'Erro ao enviar emails',
    description: result?.message || FALLBACK,
  };
}
