import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CANCEL_AI_TEXT_GENERATION,
  GENERATE_EMAIL_CAMPAIGN_TEXT,
  GET_AI_TEXT_GENERATION,
  GET_TERMHUB_SETTINGS,
} from '@/lib/queries';

import { AiTextButton } from '../ai-text-button';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/admin/events/ev-1/email',
}));
// Fast polls and a known request id.
vi.mock('@/lib/ai-text', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai-text')>()),
  GENERATION_POLL_MS: 20,
  newRequestId: () => 'req-1',
}));

const settings = (configured: boolean): MockedResponse => ({
  request: { query: GET_TERMHUB_SETTINGS },
  result: {
    data: {
      termhubSettings: {
        configured, token_hint: configured ? '…ABCD' : null, project: configured ? 'TER' : null,
        verified_at: null, server_ready: true, base_url: 'https://termhub.dev',
      },
    },
  },
});

const gen = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'g1', campaign_type: 'reminder', status, preview: null, subject: null, message: null,
  error_code: null, error_message: null, created_at: null, finished_at: null, ...extra,
});

const input = {
  eventSlug: 'ev-1', type: 'reminder', subject: 'Atual', message: null, instructions: 'tom animado', requestId: 'req-1',
};

const generateMock = (result: MockedResponse['result']): MockedResponse => ({
  request: { query: GENERATE_EMAIL_CAMPAIGN_TEXT, variables: { input } },
  result,
});

const pollMock = (generation: Record<string, unknown>): MockedResponse => ({
  request: { query: GET_AI_TEXT_GENERATION, variables: { id: 'g1' } },
  result: { data: { aiTextGeneration: generation } },
});

const renderButton = (mocks: MockedResponse[], onApply = vi.fn()) => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <AiTextButton eventSlug="ev-1" type="reminder" current={{ subject: 'Atual', message: '' }} onApply={onApply} />
    </MockedProvider>,
  );
  return onApply;
};

const openAndGenerate = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Gerar texto com IA' }));
  fireEvent.change(screen.getByLabelText('Pedido para a IA (opcional)'), { target: { value: 'tom animado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gerar' }));
};

describe('AiTextButton (REA-51)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('goes to the AI settings, and back, when no token is saved', async () => {
    renderButton([settings(false)]);
    fireEvent.click(await screen.findByRole('button', { name: /configurar/ }));
    expect(push).toHaveBeenCalledWith('/admin/configuracoes/ia?voltar=%2Fadmin%2Fevents%2Fev-1%2Femail');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the progress while the run goes and puts the reviewed draft in the form', async () => {
    const onApply = renderButton([
      settings(true),
      generateMock({ data: { generateEmailCampaignText: gen('queued') } }),
      pollMock(gen('running', { preview: '{"subject": "Amanhã é o dia' })),
      pollMock(gen('succeeded', { subject: '⏰ Amanhã é o dia', message: 'Te esperamos.\n\nTraga um amigo.' })),
    ]);
    await openAndGenerate();

    expect(await screen.findByText('Escrevendo o texto…')).toBeInTheDocument();
    expect(screen.getByText('{"subject": "Amanhã é o dia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar geração/ })).toBeEnabled();

    expect(await screen.findByText('Rascunho pronto')).toBeInTheDocument();
    expect(screen.getByText('⏰ Amanhã é o dia')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar este texto' }));
    expect(onApply).toHaveBeenCalledWith({ subject: '⏰ Amanhã é o dia', message: 'Te esperamos.\n\nTraga um amigo.' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('cancels a running generation', async () => {
    const cancelResult = vi.fn(() => ({ data: { cancelAiTextGeneration: gen('cancelled') } }));
    renderButton([
      settings(true),
      generateMock({ data: { generateEmailCampaignText: gen('queued') } }),
      { ...pollMock(gen('running')), maxUsageCount: 100 },
      { request: { query: CANCEL_AI_TEXT_GENERATION, variables: { id: 'g1' } }, result: cancelResult },
    ]);
    await openAndGenerate();
    expect(await screen.findByText('Escrevendo o texto…')).toBeInTheDocument();
    // Closing the dialog while it runs is not allowed: cancel is the way out.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancelar geração/ }));
    expect(await screen.findByText('Geração cancelada')).toBeInTheDocument();
    expect(cancelResult).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('shows why a run failed', async () => {
    renderButton([
      settings(true),
      generateMock({ data: { generateEmailCampaignText: gen('queued') } }),
      pollMock(gen('failed', { error_code: 'agent_offline', error_message: 'A máquina do termhub que roda a IA está offline.' })),
    ]);
    await openAndGenerate();
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.queryByRole('link', { name: /configuração de IA/ })).not.toBeInTheDocument();
  });

  it('links to the settings when termhub refuses the token', async () => {
    renderButton([
      settings(true),
      generateMock({ errors: [{ message: 'O termhub recusou o token', extensions: { code: 'TERMHUB_TOKEN_INVALID' } }] as never }),
    ]);
    await openAndGenerate();
    expect(await screen.findByRole('alert')).toHaveTextContent('recusou o token');
    expect(screen.getByRole('link', { name: /configuração de IA/ }))
      .toHaveAttribute('href', '/admin/configuracoes/ia?voltar=%2Fadmin%2Fevents%2Fev-1%2Femail');
  });

  it('shows the limit message of the BFF', async () => {
    renderButton([
      settings(true),
      generateMock({ errors: [{ message: 'Já há 2 gerações em andamento.', extensions: { code: 'TERMHUB_BUSY' } }] as never }),
    ]);
    await openAndGenerate();
    expect(await screen.findByRole('alert')).toHaveTextContent('2 gerações em andamento');
  });
});
