import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET_TERMHUB_SETTINGS, SAVE_TERMHUB_SETTINGS, TEST_TERMHUB_SETTINGS } from '@/lib/queries';

import { TermhubSettingsPanel } from '../termhub-settings';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TOKEN = 'thp_super_secret_token_ABCD';

const settingsOf = (extra: Record<string, unknown> = {}) => ({
  configured: false, token_hint: null, project: null, verified_at: null, server_ready: true, base_url: 'https://termhub.dev', ...extra,
});
const saved = settingsOf({ configured: true, token_hint: '…ABCD', project: 'TER', verified_at: '2026-11-15T17:03:00Z' });

const load = (data: Record<string, unknown>): MockedResponse => ({
  request: { query: GET_TERMHUB_SETTINGS },
  result: { data: { termhubSettings: data } },
});

const renderPanel = (mocks: MockedResponse[], returnTo?: string) =>
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <TermhubSettingsPanel returnTo={returnTo} />
    </MockedProvider>,
  );

describe('TermhubSettingsPanel (REA-51)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves and tests a new token, clears it from the form and goes back to the campaign', async () => {
    const save = vi.fn(() => ({ data: { saveTermhubSettings: saved } }));
    renderPanel([
      load(settingsOf()),
      { request: { query: SAVE_TERMHUB_SETTINGS, variables: { input: { token: TOKEN, project: 'TER' } } }, result: save },
    ], '/admin/events/ev-1/email');

    const tokenInput = await screen.findByLabelText('Token do termhub');
    expect(tokenInput).toHaveAttribute('type', 'password');
    const submit = screen.getByRole('button', { name: /Salvar e testar/ });
    expect(submit).toBeDisabled();
    fireEvent.change(tokenInput, { target: { value: TOKEN } });
    fireEvent.change(screen.getByLabelText('Projeto do termhub'), { target: { value: 'TER' } });
    fireEvent.click(submit);

    await waitFor(() => expect(save).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/events/ev-1/email'));
    expect(await screen.findByText(/Token salvo …ABCD · projeto TER/)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(TOKEN);
  });

  it('shows the saved token only by its end, and can test it again', async () => {
    const test = vi.fn(() => ({ data: { testTermhubSettings: saved } }));
    renderPanel([load(saved), { request: { query: TEST_TERMHUB_SETTINGS }, result: test }]);
    expect(await screen.findByText(/Token salvo …ABCD · projeto TER/)).toBeInTheDocument();
    expect(screen.getByText(/Testado em 15\/11\/2026, 14:03/)).toBeInTheDocument();
    expect(screen.getByLabelText('Novo token (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('Projeto do termhub')).toHaveValue('TER');
    fireEvent.click(screen.getByRole('button', { name: /Testar de novo/ }));
    await waitFor(() => expect(test).toHaveBeenCalled());
  });

  it('keeps the form and shows the reason when termhub refuses the token', async () => {
    renderPanel([
      load(settingsOf()),
      {
        request: { query: SAVE_TERMHUB_SETTINGS, variables: { input: { token: TOKEN, project: 'TER' } } },
        result: { errors: [{ message: 'O token do termhub não tem o escopo "runs".', extensions: { code: 'TERMHUB_TOKEN_SCOPE' } }] as never },
      },
    ]);
    fireEvent.change(await screen.findByLabelText('Token do termhub'), { target: { value: TOKEN } });
    fireEvent.change(screen.getByLabelText('Projeto do termhub'), { target: { value: 'TER' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar e testar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('escopo "runs"');
    expect(push).not.toHaveBeenCalled();
  });

  it('warns and blocks saving while the server has no key', async () => {
    renderPanel([load(settingsOf({ server_ready: false }))]);
    expect(await screen.findByRole('alert')).toHaveTextContent('TERMHUB_TOKEN_KEY');
    fireEvent.change(screen.getByLabelText('Token do termhub'), { target: { value: TOKEN } });
    fireEvent.change(screen.getByLabelText('Projeto do termhub'), { target: { value: 'TER' } });
    expect(screen.getByRole('button', { name: /Salvar e testar/ })).toBeDisabled();
  });
});
