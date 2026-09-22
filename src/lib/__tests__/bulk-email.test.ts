import { describe, it, expect } from 'vitest';
import { bulkEmailToast } from '../bulk-email';

describe('bulkEmailToast', () => {
  it('reports how many emails were queued', () => {
    expect(bulkEmailToast({ success: true, message: 'ok', queued_count: 12 })).toEqual({
      title: '12 emails na fila',
    });
  });

  it('uses the singular for one email', () => {
    expect(bulkEmailToast({ success: true, queued_count: 1 })).toEqual({
      title: '1 email na fila',
    });
  });

  it('shows the BFF message on failure', () => {
    expect(
      bulkEmailToast({ success: false, message: 'Evento não encontrado', queued_count: 0 }),
    ).toEqual({
      variant: 'destructive',
      title: 'Erro ao enviar emails',
      description: 'Evento não encontrado',
    });
  });

  it('falls back to a generic message without a response or message', () => {
    const fallback = {
      variant: 'destructive',
      title: 'Erro ao enviar emails',
      description: 'Não foi possível enfileirar os emails.',
    };
    expect(bulkEmailToast(null)).toEqual(fallback);
    expect(bulkEmailToast({ success: false, queued_count: 0 })).toEqual(fallback);
  });
});
