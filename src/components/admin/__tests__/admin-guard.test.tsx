import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminGuard, useAdminAccess } from '../admin-guard';

const replace = vi.fn();
let pathname = '/admin/events';
const signOut = vi.fn();
const requestLogin = vi.fn();
let auth: Record<string, unknown> = { isAuthenticated: true, isHydrated: true, signOut };
let result: any = { data: undefined, loading: true, error: undefined, refetch: vi.fn() };
let lastOptions: any = null;

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/login-prompt-context', () => ({
  useLoginPrompt: () => ({ requestLogin, isOpen: false }),
}));
vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  return {
    ...actual,
    useQuery: (_doc: any, options: any) => {
      lastOptions = options;
      return result;
    },
  };
});

const access = (overrides = {}) => ({
  role: 'community-manager',
  isAdmin: false,
  isCommunityManager: true,
  canAccessAdmin: true,
  communities: [{ id: 'c-1', title: 'Minha' }],
  ...overrides,
});

function Content() {
  const value = useAdminAccess();
  return <p>conteúdo para {value.role}</p>;
}

const renderGuard = () =>
  render(
    <AdminGuard>
      <Content />
    </AdminGuard>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  pathname = '/admin/events';
  auth = { isAuthenticated: true, isHydrated: true, signOut };
  result = { data: undefined, loading: true, error: undefined, refetch: vi.fn() };
});

describe('AdminGuard', () => {
  it('waits for the saved session without asking the BFF or redirecting', () => {
    auth = { isAuthenticated: false, isHydrated: false, signOut };
    renderGuard();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(lastOptions.skip).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it('asks whoever is not signed in to log in on the same page (REA-25), without leaking content', () => {
    auth = { isAuthenticated: false, isHydrated: true, signOut };
    renderGuard();
    expect(screen.getByRole('heading', { name: 'Entre para continuar' })).toBeInTheDocument();
    expect(requestLogin).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(lastOptions.skip).toBe(true);
    expect(screen.queryByText(/conteúdo/)).not.toBeInTheDocument();
  });

  it('keeps a button to open the login again after the modal is closed', () => {
    auth = { isAuthenticated: false, isHydrated: true, signOut };
    renderGuard();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(requestLogin).toHaveBeenCalledTimes(2);
  });

  it('drops a token the BFF no longer accepts and asks for the login', async () => {
    result = { data: { adminAccess: null }, loading: false };
    renderGuard();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(screen.queryByText(/conteúdo/)).not.toBeInTheDocument();
  });

  it('shows "Sem acesso" to a user without the role', () => {
    result = { data: { adminAccess: access({ role: 'authenticated', isCommunityManager: false, canAccessAdmin: false }) }, loading: false };
    renderGuard();
    expect(screen.getByText('Sem acesso')).toBeInTheDocument();
    expect(screen.queryByText(/conteúdo/)).not.toBeInTheDocument();
  });

  it('lets a community-manager into the admin', () => {
    result = { data: { adminAccess: access() }, loading: false };
    renderGuard();
    expect(screen.getByText('conteúdo para community-manager')).toBeInTheDocument();
  });

  it('keeps a community-manager out of the admin-only areas', () => {
    pathname = '/admin/usuarios';
    result = { data: { adminAccess: access() }, loading: false };
    renderGuard();
    expect(screen.getByText('Sem acesso')).toBeInTheDocument();
  });

  it('lets the admin into the admin-only areas', () => {
    pathname = '/admin/usuarios';
    result = { data: { adminAccess: access({ role: 'admin', isAdmin: true, isCommunityManager: false }) }, loading: false };
    renderGuard();
    expect(screen.getByText('conteúdo para admin')).toBeInTheDocument();
  });

  it('offers a retry when the check fails', () => {
    const refetch = vi.fn();
    result = { data: undefined, loading: false, error: new Error('down'), refetch };
    renderGuard();
    screen.getByRole('button', { name: 'Tentar de novo' }).click();
    expect(refetch).toHaveBeenCalled();
  });
});
