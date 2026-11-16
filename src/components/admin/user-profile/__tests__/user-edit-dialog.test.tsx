import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADMIN_CHECK_USER_EMAIL, ADMIN_UPDATE_USER, ADMIN_USER_PROFILE } from '@/lib/queries';
import type { AdminUserProfile } from '@/lib/types';

import { UserEditDialog } from '../user-edit-dialog';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const profile: AdminUserProfile = {
  id: '620',
  name: 'João',
  email: 'joao@errado.com',
  phone: '62 99999-0000',
  cpf_masked: '***.982.247-**',
  date_of_birth: '1990-05-01',
  marketing_opt_in: false,
  communities: [],
  events: [],
};

const result = (extra: Record<string, unknown> = {}) => ({
  changedFields: ['email'], signupsMoved: 2, signupsKept: 0, signupsFailed: 0, sessionsRevoked: true,
  message: 'Dados atualizados.', ...extra,
});

const checkMock = (check: Record<string, unknown>): MockedResponse => ({
  request: { query: ADMIN_CHECK_USER_EMAIL, variables: { userId: '620', email: 'joao@certo.com' } },
  result: { data: { adminCheckUserEmail: { message: null, signupConflicts: 0, ...check } } },
});

const updateMock = (input: Record<string, unknown>, moveSignups: boolean, onCall = vi.fn()): MockedResponse => ({
  request: { query: ADMIN_UPDATE_USER, variables: { userId: '620', input, moveSignups } },
  result: () => {
    onCall();
    return { data: { adminUpdateUser: result() } };
  },
});

// The refetch after saving.
const profileMock: MockedResponse = {
  request: { query: ADMIN_USER_PROFILE, variables: { userId: '620' } },
  result: { data: { adminUserProfile: null } },
};

const renderDialog = (mocks: MockedResponse[]) => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <UserEditDialog profile={profile} />
    </MockedProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
};

const typeEmail = (value: string) => {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
};

beforeEach(() => toast.mockReset());

describe('UserEditDialog (REA-63)', () => {
  it('asks before changing the e-mail, then moves the signups', async () => {
    const saved = vi.fn();
    renderDialog([
      checkMock({ available: true, signupsToMove: 2 }),
      updateMock({ email: 'joao@certo.com' }, true, saved),
      profileMock,
    ]);
    typeEmail('Joao@Certo.com');

    expect(await screen.findByText('Trocar o e-mail?')).toBeInTheDocument();
    expect(screen.getByText(/sessões abertas da conta serão encerradas/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Passar as inscrições/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar o e-mail' }));

    await waitFor(() => expect(saved).toHaveBeenCalled());
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cadastro atualizado' })));
  });

  it('keeps the signups on the old e-mail when the admin unticks it', async () => {
    const saved = vi.fn();
    renderDialog([
      checkMock({ available: true, signupsToMove: 2 }),
      updateMock({ email: 'joao@certo.com' }, false, saved),
      profileMock,
    ]);
    typeEmail('joao@certo.com');
    fireEvent.click(await screen.findByRole('checkbox', { name: /Passar as inscrições/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Trocar o e-mail' }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
  });

  it('shows on the field an e-mail that is already of another account', async () => {
    renderDialog([checkMock({ available: false, message: 'Este e-mail já é de outra conta.', signupsToMove: 0 })]);
    typeEmail('joao@certo.com');
    expect(await screen.findByText('Este e-mail já é de outra conta.')).toBeInTheDocument();
    expect(screen.queryByText('Trocar o e-mail?')).not.toBeInTheDocument();
  });

  it('saves the other fields without the e-mail confirmation', async () => {
    const saved = vi.fn();
    renderDialog([updateMock({ phone: '62 98888-0000' }, false, saved), profileMock]);
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '62 98888-0000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
  });

  it('refuses an invalid CPF before asking the server', async () => {
    renderDialog([]);
    fireEvent.change(screen.getByLabelText('Novo CPF'), { target: { value: '111.111.111-11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Informe um CPF válido.')).toBeInTheDocument();
  });
});
