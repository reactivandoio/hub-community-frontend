import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '../page';

// ─── Mocks ────────────────────────────────────────────────────────

const mockResetPassword = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    resetPassword: mockResetPassword,
  }),
}));

let mockSearchParams = new URLSearchParams();

const mockReplace = vi.fn();
const mockRequestLogin = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/contexts/login-prompt-context', () => ({
  useLoginPrompt: () => ({ requestLogin: mockRequestLogin, isOpen: false }),
}));

vi.mock('@/components/animations/fade-in', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ─── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

// ─── Invalid link (no code) ───────────────────────────────────────
describe('ResetPasswordPage — no code param', () => {
  it('shows invalid link message when no code is provided', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText('Link inválido')).toBeInTheDocument();
    expect(screen.getByText('Voltar para a página inicial')).toBeInTheDocument();
  });

  it('has a link back to homepage', () => {
    render(<ResetPasswordPage />);

    const link = screen.getByRole('link', { name: /voltar para a página inicial/i });
    expect(link).toHaveAttribute('href', '/');
  });
});

// ─── Form rendering ───────────────────────────────────────────────
describe('ResetPasswordPage — form', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('code=valid-token');
  });

  it('renders the password form when code is present', () => {
    render(<ResetPasswordPage />);

    const titles = screen.getAllByText('Redefinir Senha');
    expect(titles.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Digite sua nova senha abaixo')).toBeInTheDocument();
    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /redefinir senha/i })).toBeInTheDocument();
  });
});

// ─── Client-side validation ───────────────────────────────────────
describe('ResetPasswordPage — validation', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('code=valid-token');
  });

  it('shows error for short password', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('Nova senha'), 'short');
    await user.type(screen.getByLabelText('Confirmar senha'), 'short');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    expect(screen.getByText('A senha deve ter pelo menos 8 caracteres')).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('shows error for mismatched passwords', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('Nova senha'), 'validpassword1');
    await user.type(screen.getByLabelText('Confirmar senha'), 'validpassword2');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    expect(screen.getByText('As senhas não coincidem')).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });
});

// ─── Successful reset ─────────────────────────────────────────────
describe('ResetPasswordPage — success', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('code=valid-token');
    mockResetPassword.mockResolvedValue(undefined);
  });

  it('calls resetPassword and shows success state', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('Nova senha'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(screen.getByText('Senha redefinida com sucesso!')).toBeInTheDocument();
    });

    expect(mockResetPassword).toHaveBeenCalledWith(
      'valid-token',
      'newpassword123',
      'newpassword123'
    );

    // REA-25: the login opens on this page; without a kept page it stays here.
    await user.click(screen.getByRole('button', { name: /fazer login/i }));
    expect(mockRequestLogin).toHaveBeenCalledTimes(1);
    mockRequestLogin.mock.calls[0][0].onSuccess();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ─── Error handling ───────────────────────────────────────────────
describe('ResetPasswordPage — error handling', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('code=expired-token');
  });

  it('shows expired message for expired/invalid token errors', async () => {
    mockResetPassword.mockRejectedValue(new Error('Token expired'));
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('Nova senha'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/link de redefinição expirou/i)
      ).toBeInTheDocument();
    });
  });

  it('shows expired message for invalid token errors', async () => {
    mockResetPassword.mockRejectedValue(new Error('Invalid code provided'));
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('Nova senha'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/link de redefinição expirou/i)
      ).toBeInTheDocument();
    });
  });

  it('shows generic error for other failures', async () => {
    mockResetPassword.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('Nova senha'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Erro ao redefinir a senha. Tente novamente.')
      ).toBeInTheDocument();
    });
  });
});
