import { ApolloError } from '@apollo/client';
import { GraphQLError } from 'graphql';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthModal, loginError } from '../auth-modal';

const requestLoginCode = vi.fn();
const verifyLoginCode = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ requestLoginCode, verifyLoginCode, isLoading: false }),
}));
const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast }));

const apolloError = (message: string, extensions: Record<string, unknown>) =>
  new ApolloError({ graphQLErrors: [new GraphQLError(message, { extensions })] });

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/certificado?event=meetup');
  requestLoginCode.mockResolvedValue({ resendIn: 60 });
  verifyLoginCode.mockResolvedValue(undefined);
});

const renderModal = () => {
  const onClose = vi.fn();
  const onSignedIn = vi.fn();
  render(<AuthModal isOpen onClose={onClose} onSignedIn={onSignedIn} reason="Entre para continuar" />);
  return { onClose, onSignedIn };
};

const askCode = async (user: ReturnType<typeof userEvent.setup>, email = 'Ana@Example.com') => {
  await user.type(screen.getByLabelText('Seu e-mail'), email);
  await user.click(screen.getByRole('button', { name: 'Receber código' }));
  await screen.findByLabelText('Código');
};

describe('AuthModal (REA-25: login in place)', () => {
  it('is an accessible dialog that says why the login is asked for', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Entrar na sua conta' });
    expect(dialog).toHaveAccessibleDescription('Entre para continuar');
  });

  it('closes with Esc', async () => {
    const { onClose } = renderModal();
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AuthModal — login por código (REA-26)', () => {
  it('has no password anywhere', () => {
    renderModal();
    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('asks for the e-mail, then the code, and reports the login to the page without navigating', async () => {
    const { onSignedIn, onClose } = renderModal();
    const user = userEvent.setup();

    await askCode(user);
    expect(requestLoginCode).toHaveBeenCalledWith('Ana@Example.com');
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Código'), '012 345');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(verifyLoginCode).toHaveBeenCalledWith('ana@example.com', '012345');
    expect(onClose).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/certificado');
  });

  it('does not send an incomplete code', async () => {
    renderModal();
    const user = userEvent.setup();
    await askCode(user);
    await user.type(screen.getByLabelText('Código'), '123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Digite os 6 números do código.')).toBeInTheDocument();
    expect(verifyLoginCode).not.toHaveBeenCalled();
  });

  it('shows the BFF message on a wrong code and keeps the person on the code step', async () => {
    verifyLoginCode.mockRejectedValue(
      apolloError('Código incorreto. Você tem mais 4 tentativas.', { code: 'LOGIN_CODE_INVALID', attemptsLeft: 4 }),
    );
    const { onSignedIn } = renderModal();
    const user = userEvent.setup();
    await askCode(user);
    await user.type(screen.getByLabelText('Código'), '999999');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Código incorreto. Você tem mais 4 tentativas.')).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('waits before another code can be asked for', async () => {
    renderModal();
    const user = userEvent.setup();
    await askCode(user);
    expect(screen.getByRole('button', { name: /Reenviar em \d+s/ })).toBeDisabled();
  });

  it('tells when the code could not be sent (Mailgun refused) and stays on the e-mail step', async () => {
    requestLoginCode.mockRejectedValue(
      apolloError('Não conseguimos enviar o código agora. Tente de novo em 60 segundos.', {
        code: 'LOGIN_CODE_NOT_SENT',
        retryAfter: 60,
      }),
    );
    renderModal();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Seu e-mail'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Receber código' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Não conseguimos enviar o código agora. Tente de novo em 60 segundos.'),
    );
    expect(screen.getByLabelText('Seu e-mail')).toBeInTheDocument();
  });

  it('goes on to the code step when a code was sent a moment ago (cooldown)', async () => {
    requestLoginCode.mockRejectedValue(
      apolloError('Enviamos um código há pouco. Peça outro em 40 segundos.', { code: 'LOGIN_CODE_COOLDOWN', retryAfter: 40 }),
    );
    renderModal();
    const user = userEvent.setup();
    await askCode(user);
    expect(screen.getByRole('button', { name: 'Reenviar em 40s' })).toBeDisabled();
  });

  it('"Usar outro e-mail" goes back to the first step', async () => {
    renderModal();
    const user = userEvent.setup();
    await askCode(user);
    await user.click(screen.getByRole('button', { name: 'Usar outro e-mail' }));
    expect(screen.getByLabelText('Seu e-mail')).toHaveValue('');
  });
});

describe('loginError', () => {
  it('reads the message, the code and retryAfter of a GraphQL error', () => {
    expect(loginError(apolloError('x', { code: 'LOGIN_CODE_COOLDOWN', retryAfter: 30 }), 'f')).toEqual({
      message: 'x',
      code: 'LOGIN_CODE_COOLDOWN',
      retryAfter: 30,
    });
  });

  it('falls back on anything else', () => {
    expect(loginError(new Error('boom'), 'fallback')).toEqual({ message: 'fallback' });
  });
});
