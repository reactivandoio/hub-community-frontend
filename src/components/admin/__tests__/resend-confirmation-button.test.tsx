import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RESEND_SIGNUP_CONFIRMATION } from '@/lib/queries';

import { ResendConfirmationButton } from '../resend-confirmation-button';

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const signup = { signup_id: '42', name: 'Ana Souza', email: 'ana@x.io', payment_status: 'CONFIRMED' };
const vars = { event: 'ev-1', signupId: '42' };

const resend = (data: Record<string, unknown>) => {
  const result = vi.fn(() => ({
    data: { resendSignupConfirmation: { success: true, message: null, sent_at: null, retry_after: null, ...data } },
  }));
  return { mock: { request: { query: RESEND_SIGNUP_CONFIRMATION, variables: vars }, result } as MockedResponse, result };
};

const renderButton = (mocks: MockedResponse[], extra: Record<string, unknown> = {}, onResent = vi.fn()) => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <ResendConfirmationButton event="ev-1" signup={{ ...signup, ...extra }} onResent={onResent} />
    </MockedProvider>,
  );
  return onResent;
};

describe('ResendConfirmationButton (REA-50)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks before resending and says where it goes', async () => {
    const { mock, result } = resend({});
    renderButton([mock]);
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação para Ana Souza' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('ana@x.io');
    expect(result).not.toHaveBeenCalled();
  });

  it('resends, tells it, records the date and holds the button for a minute', async () => {
    const sentAt = new Date().toISOString();
    const { mock, result } = resend({ message: 'E-mail de confirmação reenviado para ana@x.io.', sent_at: sentAt });
    const onResent = renderButton([mock]);
    fireEvent.click(screen.getByRole('button', { name: /Reenviar e-mail de confirmação/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar' }));

    await waitFor(() => expect(onResent).toHaveBeenCalled());
    expect(result).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'E-mail reenviado' }));
    expect(screen.getByText(/^Reenviado em/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar e-mail de confirmação/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reenviar e-mail de confirmação/ })).toHaveTextContent(/Aguarde \d+s/);
  });

  it('shows the reason when the e-mail could not go (quota)', async () => {
    const message = 'O provedor de e-mail recusou o envio: a cota de e-mails do dia provavelmente acabou.';
    const { mock } = resend({ success: false, message });
    const onResent = renderButton([mock]);
    fireEvent.click(screen.getByRole('button', { name: /Reenviar e-mail de confirmação/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'O e-mail não foi reenviado', description: message, variant: 'destructive' }),
      ),
    );
    expect(onResent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Reenviar e-mail de confirmação/ })).toBeEnabled();
  });

  it('flags a first send that failed, with the provider message on hover', () => {
    renderButton([], { confirmation_email_status: 'failed', confirmation_email_error: '421 daily limit' });
    expect(screen.getByText('Não enviado')).toHaveAttribute('title', '421 daily limit');
  });

  it('shows the last resend from the list', () => {
    renderButton([], { confirmation_resent_at: '2026-11-14T13:30:00.000Z' });
    expect(screen.getByText('Reenviado em 14/11/2026 10:30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar e-mail de confirmação/ })).toBeEnabled();
  });
});
