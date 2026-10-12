import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UsersAdminPage from '../page';

const setUserRole = vi.fn();
const refetch = vi.fn();
const usersCalls: any[] = [];
const toast = vi.fn();

const users = [
  { id: '1', username: 'root', email: 'root@x.io', name: 'Root', blocked: false, role: { type: 'admin', name: 'Admin' }, communities: [] },
  { id: '5', username: 'bia', email: 'bia@x.io', name: 'Bia', blocked: false, role: { type: 'authenticated', name: 'Usuário' }, communities: [{ id: 'c-1', title: 'Comunidade Teste' }] },
];
const roles = [
  { type: 'authenticated', name: 'Usuário' },
  { type: 'community-manager', name: 'Community Manager' },
  { type: 'admin', name: 'Admin' },
];
const usersResult = { data: { adminUsers: { items: users, total: 2, page: 1, pageSize: 20 } }, loading: false, refetch };
const rolesResult = { data: { adminRoles: roles }, loading: false };
const historyResult = {
  data: {
    roleChanges: {
      items: [{ id: 'h1', actorEmail: 'root@x.io', targetId: '5', targetEmail: 'bia@x.io', fromRole: 'authenticated', toRole: 'community-manager', createdAt: '2026-10-12T00:00:00.000Z' }],
      total: 1,
      page: 1,
      pageSize: 20,
    },
  },
  loading: false,
};

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { email: 'root@x.io' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/use-debounce', () => ({ useDebounce: (value: unknown) => value }));
vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  const name = (doc: any) => doc?.definitions?.[0]?.name?.value;
  return {
    ...actual,
    useQuery: (doc: any, options: any) => {
      if (name(doc) === 'AdminUsers') {
        usersCalls.push(options.variables);
        return usersResult;
      }
      if (name(doc) === 'AdminRoles') return rolesResult;
      return historyResult;
    },
    useMutation: () => [setUserRole, { loading: false }],
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  usersCalls.length = 0;
  setUserRole.mockResolvedValue({ data: {} });
});

// Radix Select needs pointer capture APIs jsdom does not have.
beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

describe('UsersAdminPage', () => {
  it('lists users with role, communities and the history', () => {
    render(<UsersAdminPage />);
    expect(screen.getByText('bia@x.io', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('Comunidade Teste')).toBeInTheDocument();
    expect(screen.getByText('Histórico de trocas de role')).toBeInTheDocument();
    expect(screen.getByText('Usuário → Community Manager')).toBeInTheDocument();
  });

  it('searches from page 1', () => {
    render(<UsersAdminPage />);
    fireEvent.change(screen.getByLabelText('Buscar usuários'), { target: { value: ' bia ' } });
    expect(usersCalls.at(-1)).toEqual({ search: 'bia', role: null, page: 1, pageSize: 20 });
  });

  it('changes a role only after confirming', async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);
    await user.click(screen.getByLabelText('Role de bia@x.io'));
    await user.click(await screen.findByRole('option', { name: 'Community Manager' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Usuário → Community Manager/)).toBeInTheDocument();
    expect(setUserRole).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(setUserRole).toHaveBeenCalledWith({ variables: { userId: '5', roleType: 'community-manager' } }));
    expect(refetch).toHaveBeenCalled();
  });

  it('does not offer the admin a way to drop their own admin role', async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);
    await user.click(screen.getByLabelText('Role de root@x.io'));
    expect(await screen.findByRole('option', { name: 'Usuário' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the BFF refusal', async () => {
    setUserRole.mockRejectedValue(new Error('O sistema precisa de pelo menos um admin ativo.'));
    const user = userEvent.setup();
    render(<UsersAdminPage />);
    await user.click(screen.getByLabelText('Role de bia@x.io'));
    await user.click(await screen.findByRole('option', { name: 'Admin' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'O sistema precisa de pelo menos um admin ativo.' })));
  });
});
