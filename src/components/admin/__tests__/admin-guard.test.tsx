import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminGuard, useAdminAccess } from '../admin-guard';

const replace = vi.fn();
let pathname = '/admin/events';
let auth = { isAuthenticated: true, isHydrated: true };
let result: any = { data: undefined, loading: true, error: undefined, refetch: vi.fn() };
let lastOptions: any = null;

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth }));
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
  auth = { isAuthenticated: true, isHydrated: true };
  result = { data: undefined, loading: true, error: undefined, refetch: vi.fn() };
});

describe('AdminGuard', () => {
  it('waits for the saved session without asking the BFF or redirecting', () => {
    auth = { isAuthenticated: false, isHydrated: false };
    renderGuard();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(lastOptions.skip).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends whoever is not signed in to the login, back to the same page', async () => {
    auth = { isAuthenticated: false, isHydrated: true };
    window.history.pushState({}, '', '/admin/events?tab=1');
    renderGuard();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/?login=true&redirect=%2Fadmin%2Fevents%3Ftab%3D1'));
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
