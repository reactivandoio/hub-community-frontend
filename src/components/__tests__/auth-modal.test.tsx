import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthModal } from '../auth-modal';

const signIn = vi.fn();
const forwardPassword = vi.fn();
const signUp = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ signIn, signUp, forwardPassword, isLoading: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/certificado?event=meetup');
});

const renderModal = () => {
  const onClose = vi.fn();
  const onSignedIn = vi.fn();
  render(<AuthModal isOpen onClose={onClose} onSignedIn={onSignedIn} reason="Entre para continuar" />);
  return { onClose, onSignedIn };
};

describe('AuthModal (REA-25: login in place)', () => {
  it('is an accessible dialog that says why the login is asked for', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Entrar na sua conta' });
    expect(dialog).toHaveAccessibleDescription('Entre para continuar');
  });

  it('signing in reports it to the page, with no navigation of its own', async () => {
    signIn.mockResolvedValue(undefined);
    const { onSignedIn, onClose } = renderModal();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email ou Username'), 'ana');
    await user.type(screen.getByLabelText('Senha'), 'senha-forte-1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith({ identifier: 'ana', password: 'senha-forte-1' });
    expect(onClose).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/certificado');
  });

  it('closes with Esc', async () => {
    const { onClose } = renderModal();
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('"Recuperar" keeps this page, so the new-password page sends the person back here', async () => {
    forwardPassword.mockResolvedValue(undefined);
    renderModal();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Recuperar' }));
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar Email de Recuperação' }));
    await waitFor(() => expect(forwardPassword).toHaveBeenCalledWith('ana@example.com'));
    expect(JSON.parse(window.localStorage.getItem('login_return_to') || '{}').path).toBe(
      '/certificado?event=meetup',
    );
  });
});

describe('AuthModal — cadastro (REA-36)', () => {
  const fillSignUp = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('tab', { name: 'Cadastrar' }));
    await user.type(screen.getByPlaceholderText('Seu nome completo'), 'Ana Souza');
    await user.type(screen.getByPlaceholderText('seu_username'), 'ana_souza');
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@example.com');
    await user.type(screen.getByPlaceholderText('Digite uma senha forte'), 'Senha-forte-1');
  };

  it('does not create the account without "18 anos ou mais"', async () => {
    renderModal();
    const user = userEvent.setup();
    await fillSignUp(user);
    await user.click(screen.getByRole('button', { name: 'Criar Conta' }));
    expect(await screen.findByText('Confirme que você tem 18 anos ou mais.')).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('sends the declaration with the signup', async () => {
    signUp.mockResolvedValue(undefined);
    renderModal();
    const user = userEvent.setup();
    await fillSignUp(user);
    await user.click(screen.getByRole('checkbox', { name: /18 anos ou mais/ }));
    await user.click(screen.getByRole('button', { name: 'Criar Conta' }));
    await waitFor(() => expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ adult_declaration: true })));
  });
});
