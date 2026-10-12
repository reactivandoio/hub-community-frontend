import { describe, expect, it } from 'vitest';

import { connectionLabel, looksLikeOpaPingouKey, opaPingouErrorMessage } from '../opapingou-account';

const conn = {
  id: 'opc_1',
  companyName: 'Comunidade A LTDA',
  companyDocument: '**.***.***/0001-22',
  testMode: false,
  keyLast4: 'wxyz',
  createdByName: 'Ana',
  createdAt: '2026-10-12T00:00:00.000Z',
};

describe('looksLikeOpaPingouKey', () => {
  it('aceita opk_live_ e opk_test_ com o token, com espaços em volta', () => {
    expect(looksLikeOpaPingouKey(`opk_live_${'a'.repeat(43)}`)).toBe(true);
    expect(looksLikeOpaPingouKey(`  opk_test_${'b'.repeat(43)}\n`)).toBe(true);
  });

  it('recusa o que não é chave', () => {
    for (const v of ['', 'opk_live_', 'opk_live_curta', 'sk_live_123456789012345678901', `opk_live_${'a'.repeat(20)} x`, 'whsec_abc']) {
      expect(looksLikeOpaPingouKey(v)).toBe(false);
    }
  });
});

describe('connectionLabel', () => {
  it('empresa, CNPJ mascarado e final da chave', () => {
    expect(connectionLabel(conn)).toBe('Comunidade A LTDA · CNPJ **.***.***/0001-22 · chave …wxyz');
  });

  it('marca a conta de teste e tolera campos vazios', () => {
    expect(connectionLabel({ ...conn, companyName: null, companyDocument: null, testMode: true })).toBe(
      'Conta Opa Pingou · chave …wxyz · teste',
    );
  });
});

describe('opaPingouErrorMessage', () => {
  it('usa a mensagem do BFF e lista as permissões que faltam', () => {
    const err = {
      graphQLErrors: [
        {
          message: 'A chave não tem todas as permissões necessárias.',
          extensions: { code: 'OPAPINGOU_MISSING_SCOPES', missing: ['charges:write', 'webhooks:write'] },
        },
      ],
    };
    expect(opaPingouErrorMessage(err)).toBe(
      'A chave não tem todas as permissões necessárias. Falta: Criar, cancelar e simular cobranças; Gerenciar endpoints e reenviar entregas de webhook.',
    );
  });

  it('sem erro GraphQL: mensagem genérica', () => {
    expect(opaPingouErrorMessage(new Error('Failed to fetch'))).toMatch(/Tente de novo/);
  });
});
