import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConvitePage from '../page';

let token = 'tok';
let auth = { isAuthenticated: false, isHydrated: true, signOut: vi.fn() };
let preview: any = null;
const accept = vi.fn();
const replace = vi.fn();
const requestLogin = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(token ? `t=${token}` : ''),
  useRouter: () => ({ replace }),
}));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/login-prompt-context', () => ({ useLoginPrompt: () => ({ requestLogin }) }));
vi.mock('@/components/login-required', () => ({
  LoginRequired: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="login-required">
      {title} — {description}
    </div>
  ),
}));
vi.mock('@apollo/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  return {
    ...actual,
    useQuery: () => ({ data: { managementInvite: preview }, loading: false }),
    useMutation: () => [accept],
  };
});

const PENDING = {
  kind: 'event_manager',
  status: 'pending',
  maskedEmail: 'mari****@***ail.com',
  communityTitle: null,
  eventTitle: 'Meetup',
  expiresAt: '2026-11-20T12:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  token = 'tok';
  auth = { isAuthenticated: false, isHydrated: true, signOut: vi.fn() };
  preview = PENDING;
});

describe('/convite (REA-48)', () => {
  it('asks for the login with the invited (masked) e-mail', () => {
    render(<ConvitePage />);
    expect(screen.getByTestId('login-required')).toHaveTextContent('Convite para gerir o evento Meetup');
    expect(screen.getByTestId('login-required')).toHaveTextContent('mari****@***ail.com');
    expect(accept).not.toHaveBeenCalled();
  });

  it('logged in, accepts it and goes to the event in the admin', async () => {
    auth = { ...auth, isAuthenticated: true };
    accept.mockResolvedValue({ data: { acceptManagementInvite: { kind: 'event_manager', eventId: 'ev-1', role: 'event-manager' } } });
    render(<ConvitePage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/events/ev-1'));
    expect(accept).toHaveBeenCalledWith({ variables: { token: 'tok' } });
  });

  it('shows why it cannot be accepted (another e-mail) and offers another login', async () => {
    auth = { ...auth, isAuthenticated: true };
    accept.mockRejectedValue({ graphQLErrors: [{ message: 'Este convite foi enviado para mari****@***ail.com. Saia e entre com esse e-mail.' }] });
    render(<ConvitePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Saia e entre com esse e-mail');
    screen.getByRole('button', { name: 'Entrar com outro e-mail' }).click();
    expect(auth.signOut).toHaveBeenCalled();
    expect(requestLogin).toHaveBeenCalled();
  });

  it('explains an expired invite, without trying it', () => {
    auth = { ...auth, isAuthenticated: true };
    preview = { ...PENDING, status: 'expired' };
    render(<ConvitePage />);
    expect(screen.getByText(/Este convite expirou/)).toBeInTheDocument();
    expect(accept).not.toHaveBeenCalled();
  });

  it('handles an unknown or incomplete link', () => {
    preview = null;
    render(<ConvitePage />);
    expect(screen.getByText('Convite não encontrado')).toBeInTheDocument();
  });
});
