import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OpaPingouAccountCard } from '../opapingou-account-card';
import {
  CONNECT_EVENT_OPAPINGOU,
  DISCONNECT_EVENT_OPAPINGOU,
  EVENT_OPAPINGOU_ACCOUNT,
  USE_OPAPINGOU_CONNECTION,
} from '@/lib/queries';
import type { EventOpaPingouAccount, OpaPingouConnection } from '@/lib/types';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const KEY = `opk_live_${'k'.repeat(39)}wxyz`;

const conn = (over: Partial<OpaPingouConnection> = {}): OpaPingouConnection => ({
  id: 'opc_a',
  companyName: 'Comunidade A LTDA',
  companyDocument: '**.***.***/0001-22',
  testMode: false,
  keyLast4: 'wxyz',
  createdByName: 'Ana',
  createdAt: '2026-10-12T00:00:00.000Z',
  ...over,
});

const account = (over: Partial<EventOpaPingouAccount> = {}): EventOpaPingouAccount => ({
  connection: null,
  legacy: false,
  available: true,
  reusable: [],
  ...over,
});

const load = (a: EventOpaPingouAccount): MockedResponse => ({
  request: { query: EVENT_OPAPINGOU_ACCOUNT, variables: { eventId: 'ev1' } },
  result: { data: { eventOpaPingouAccount: a } },
});

// eventId null = event not saved yet.
const renderCard = (mocks: MockedResponse[], eventId: string | null = 'ev1') =>
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <form onSubmit={() => { throw new Error('o formulário do evento não pode ser enviado'); }}>
        <OpaPingouAccountCard eventId={eventId ?? undefined} />
      </form>
    </MockedProvider>,
  );

describe('OpaPingouAccountCard', () => {
  it('apresenta o parceiro oficial com o link de cadastro', async () => {
    renderCard([load(account())]);
    expect(screen.getByText(/parceiro oficial de pagamentos do Hub Community/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crie a sua no Opa Pingou' })).toHaveAttribute('href', 'https://opapingou.com.br/cadastro');
  });

  it('evento ainda não salvo: campo da chave sem consultar o BFF', () => {
    renderCard([], null);
    expect(screen.getByLabelText('Chave de API do Opa Pingou')).toHaveAttribute('type', 'password');
    expect(screen.queryByRole('button', { name: 'Conectar' })).not.toBeInTheDocument();
  });

  it('sem conta: avisa que o pago não aceita inscrição e mostra o campo da chave', async () => {
    renderCard([load(account())]);
    expect(await screen.findByText(/os lotes pagos deste evento não aceitam inscrição/)).toBeInTheDocument();
    expect(screen.getByLabelText('Chave de API do Opa Pingou')).toHaveAttribute('type', 'password');
  });

  it('evento legado: avisa que cobra pela conta do Hub', async () => {
    renderCard([load(account({ legacy: true }))]);
    expect(await screen.findByText(/cobrando pela conta do Hub Community/)).toBeInTheDocument();
  });

  it('conectada: mostra empresa e final da chave, sem o campo', async () => {
    renderCard([load(account({ connection: conn() }))]);
    expect(await screen.findByText('Comunidade A LTDA · CNPJ **.***.***/0001-22 · chave …wxyz')).toBeInTheDocument();
    expect(screen.queryByLabelText('Chave de API do Opa Pingou')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar conta' }));
    expect(screen.getByLabelText('Chave de API do Opa Pingou')).toBeInTheDocument();
  });

  it('conecta com Enter sem enviar o formulário do evento, limpa o campo e mostra a conta', async () => {
    const connect = vi.fn(() => ({ data: { connectEventOpaPingou: account({ connection: conn() }) } }));
    renderCard([
      load(account()),
      { request: { query: CONNECT_EVENT_OPAPINGOU, variables: { eventId: 'ev1', apiKey: KEY } }, result: connect },
    ]);
    const input = await screen.findByLabelText('Chave de API do Opa Pingou');
    fireEvent.change(input, { target: { value: `  ${KEY}  ` } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText(/Conectada:/)).toBeInTheDocument();
    expect(connect).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith({ title: 'Conta Opa Pingou conectada' });
    expect(document.body.innerHTML).not.toContain(KEY);
  });

  it('chave em formato errado: erro na hora, sem chamar o BFF', async () => {
    renderCard([load(account())]);
    const input = await screen.findByLabelText('Chave de API do Opa Pingou');
    fireEvent.change(input, { target: { value: 'minha-chave' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cole a chave inteira do Opa Pingou');
  });

  it('erro do BFF aparece com as permissões que faltam', async () => {
    renderCard([
      load(account()),
      {
        request: { query: CONNECT_EVENT_OPAPINGOU, variables: { eventId: 'ev1', apiKey: KEY } },
        result: {
          errors: [
            new GraphQLError('A chave não tem todas as permissões necessárias.', {
              extensions: { code: 'OPAPINGOU_MISSING_SCOPES', missing: ['webhooks:write'] },
            }),
          ],
        },
      },
    ]);
    const input = await screen.findByLabelText('Chave de API do Opa Pingou');
    fireEvent.change(input, { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A chave não tem todas as permissões necessárias. Falta: Gerenciar endpoints e reenviar entregas de webhook.',
    );
  });

  it('reutiliza uma conta já conectada', async () => {
    const other = conn({ id: 'opc_b', companyName: 'Comunidade B LTDA', keyLast4: 'bbbb' });
    renderCard([
      load(account({ reusable: [other] })),
      {
        request: { query: USE_OPAPINGOU_CONNECTION, variables: { eventId: 'ev1', connectionId: 'opc_b' } },
        result: { data: { useOpaPingouConnection: account({ connection: other, reusable: [other] }) } },
      },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Usar esta conta' }));
    expect(await screen.findByText(/Conectada:/)).toBeInTheDocument();
    expect(screen.getByText(/Comunidade B LTDA/)).toBeInTheDocument();
  });

  it('remover pede confirmação; Pix em aberto mostra o erro do BFF', async () => {
    renderCard([
      load(account({ connection: conn() })),
      {
        request: { query: DISCONNECT_EVENT_OPAPINGOU, variables: { eventId: 'ev1' } },
        result: {
          errors: [
            new GraphQLError('Este evento tem pagamentos em aberto. Tente de novo depois que eles forem pagos ou vencerem (até 15 minutos).', {
              extensions: { code: 'OPAPINGOU_PENDING_PAYMENTS', count: 1 },
            }),
          ],
        },
      },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }));
    expect(await screen.findByText('Remover a conta Opa Pingou deste evento?')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover' }).at(-1)!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('pagamentos em aberto'));
  });
});

describe('OpaPingouAccountCard: evento novo e estado da conta (REA-12)', () => {
  it('evento novo: campo da chave sem consultar o BFF, avisando que só o pago exige', () => {
    const onPendingKeyChange = vi.fn();
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <OpaPingouAccountCard pendingKey="" onPendingKeyChange={onPendingKeyChange} />
      </MockedProvider>,
    );
    expect(screen.getByText(/Obrigatória só se o evento tiver lote pago/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Chave de API do Opa Pingou'), { target: { value: 'opk_live_x' } });
    expect(onPendingKeyChange).toHaveBeenCalledWith('opk_live_x');
  });

  it('informa se o evento salvo pode cobrar (conta ou legado)', async () => {
    const onAccountChange = vi.fn();
    render(
      <MockedProvider mocks={[load(account({ legacy: true }))]} addTypename={false}>
        <OpaPingouAccountCard eventId="ev1" onAccountChange={onAccountChange} />
      </MockedProvider>,
    );
    await waitFor(() => expect(onAccountChange).toHaveBeenCalledWith(true));
  });

  it('sem conta nem legado: false', async () => {
    const onAccountChange = vi.fn();
    render(
      <MockedProvider mocks={[load(account())]} addTypename={false}>
        <OpaPingouAccountCard eventId="ev1" onAccountChange={onAccountChange} />
      </MockedProvider>,
    );
    await waitFor(() => expect(onAccountChange).toHaveBeenCalledWith(false));
  });
});
