import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreatePasswordPage from '../page';

const mockResetPassword = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ resetPassword: mockResetPassword }),
}));

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/components/animations/fade-in', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

describe('CreatePasswordPage', () => {
  it('shows invalid link without a code', () => {
    render(<CreatePasswordPage />);
    expect(screen.getByText('Link inválido')).toBeInTheDocument();
  });

  it('shows the welcome copy', () => {
    mockSearchParams = new URLSearchParams('code=tok');
    render(<CreatePasswordPage />);
    expect(screen.getByText('Crie sua senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar senha/i })).toBeInTheDocument();
  });

  it('sets the password with the code and sends to login', async () => {
    mockSearchParams = new URLSearchParams('code=tok');
    mockResetPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CreatePasswordPage />);

    await user.type(screen.getByLabelText('Nova senha'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /criar senha/i }));

    await waitFor(() => {
      expect(screen.getByText('Senha criada com sucesso!')).toBeInTheDocument();
    });
    expect(mockResetPassword).toHaveBeenCalledWith('tok', 'newpassword123', 'newpassword123');
    expect(screen.getByRole('link', { name: /fazer login/i })).toHaveAttribute(
      'href',
      '/?login=true',
    );
  });

  it('explains an expired or used link', async () => {
    mockSearchParams = new URLSearchParams('code=old');
    mockResetPassword.mockRejectedValue(new Error('Incorrect code provided'));
    const user = userEvent.setup();
    render(<CreatePasswordPage />);

    await user.type(screen.getByLabelText('Nova senha'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /criar senha/i }));

    await waitFor(() => {
      expect(screen.getByText(/expirou ou já foi usado/i)).toBeInTheDocument();
    });
  });
});
