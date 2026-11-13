import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManagementPeople } from '@/components/admin/management-people';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const PEOPLE = [{ id: 'u-eva', name: 'Eva', email: 'eva@x.io' }];
const INVITES = [{ id: 'inv-1', email: 'bia@x.io', status: 'pending', expiresAt: '2026-11-20T12:00:00Z', invitedByEmail: 'ana@x.io' }];

const setup = (props: Partial<React.ComponentProps<typeof ManagementPeople>> = {}) => {
  const handlers = {
    onInvite: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    onRevoke: vi.fn().mockResolvedValue(undefined),
  };
  render(
    <ManagementPeople
      noun="gestor"
      people={PEOPLE}
      invites={INVITES}
      canManage
      emptyText="Este evento não tem gestores."
      {...handlers}
      {...props}
    />
  );
  return handlers;
};

beforeEach(() => vi.clearAllMocks());

describe('ManagementPeople (REA-48)', () => {
  it('invites by e-mail and clears the field', async () => {
    const { onInvite } = setup();
    const input = screen.getByLabelText('Convidar gestor por e-mail');
    await userEvent.type(input, 'nova@x.io');
    await userEvent.click(screen.getByRole('button', { name: 'Convidar' }));
    expect(onInvite).toHaveBeenCalledWith('nova@x.io');
    await waitFor(() => expect(input).toHaveValue(''));
    expect(toast).toHaveBeenCalledWith({ title: 'Convite enviado para nova@x.io.' });
  });

  it('shows the error of the BFF and keeps what was typed', async () => {
    const { onInvite } = setup();
    onInvite.mockRejectedValueOnce({ graphQLErrors: [{ message: 'Esta pessoa já gere o evento.' }] });
    await userEvent.type(screen.getByLabelText('Convidar gestor por e-mail'), 'eva@x.io');
    await userEvent.click(screen.getByRole('button', { name: 'Convidar' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'Esta pessoa já gere o evento.' }));
    expect(screen.getByLabelText('Convidar gestor por e-mail')).toHaveValue('eva@x.io');
  });

  it('removes after a confirmation, and cancels a pending invite', async () => {
    const { onRemove, onRevoke } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Remover Eva' }));
    expect(onRemove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remover' }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(PEOPLE[0]));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar o convite de bia@x.io' }));
    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith(INVITES[0]));
  });

  it('only lists for who cannot manage (a manager sees the other managers)', () => {
    setup({ canManage: false });
    expect(screen.getByText('Eva')).toBeInTheDocument();
    expect(screen.queryByLabelText('Convidar gestor por e-mail')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Convites pendentes')).not.toBeInTheDocument();
  });

  it('says when nobody is there', () => {
    setup({ people: [] });
    expect(screen.getByText('Este evento não tem gestores.')).toBeInTheDocument();
  });
});
