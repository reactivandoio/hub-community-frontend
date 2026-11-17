import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADMIN_MERGE_PREVIEW, ADMIN_MERGE_USERS } from '@/lib/queries';

import { UserMergeDialog } from '../user-merge-dialog';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const ACCOUNTS = [
  { id: '620', name: 'Wagdson', email: 'wagdson.ope@x.io' },
  { id: '621', name: 'Wagdson', email: 'wagdson.sd@x.io' },
];

const preview = (over: Record<string, unknown> = {}) => ({
  keep: { id: '621', name: 'Wagdson', email: 'wagdson.sd@x.io', role: 'authenticated', blocked: false },
  drop: { id: '620', name: 'Wagdson', email: 'wagdson.ope@x.io', role: 'authenticated', blocked: false },
  blockers: [],
  canMerge: true,
  links: [{ label: 'Perfil de palestrante', count: 1 }],
  certificatesByEmail: 0,
  requestsByEmail: 0,
  filledFields: [],
  signupsToMove: 1,
  signupConflicts: 0,
  ...over,
});

const previewMock = (keep: string, drop: string, over: Record<string, unknown> = {}): MockedResponse => ({
  request: { query: ADMIN_MERGE_PREVIEW, variables: { keepUserId: keep, dropUserId: drop } },
  result: { data: { adminMergePreview: preview(over) } },
});

const mergeResult = {
  keepUserId: '621',
  linksMoved: [{ label: 'Perfil de palestrante', count: 1 }],
  certificatesByEmail: 0,
  requestsByEmail: 0,
  filledFields: [],
  signupsMoved: 1,
  signupsKept: 0,
  signupsFailed: 0,
  recorded: true,
  message: 'Contas juntadas.',
};

const mergeMock = (onCall = vi.fn()): MockedResponse => ({
  request: { query: ADMIN_MERGE_USERS, variables: { keepUserId: '621', dropUserId: '620' } },
  result: () => {
    onCall();
    return { data: { adminMergeUsers: mergeResult } };
  },
});

const renderDialog = (mocks: MockedResponse[], props: Partial<Parameters<typeof UserMergeDialog>[0]> = {}) => {
  const onOpenChange = vi.fn();
  const onMerged = vi.fn();
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <UserMergeDialog accounts={ACCOUNTS} open onOpenChange={onOpenChange} onMerged={onMerged} {...props} />
    </MockedProvider>,
  );
  return { onOpenChange, onMerged };
};

beforeEach(() => toast.mockReset());

describe('UserMergeDialog (REA-96)', () => {
  it('shows what moves for the suggested account, and joins only on the click', async () => {
    const merged = vi.fn();
    const { onMerged, onOpenChange } = renderDialog([previewMock('621', '620'), mergeMock(merged)], { defaultKeepId: '621' });

    expect(await screen.findByText('Perfil de palestrante: 1')).toBeInTheDocument();
    expect(screen.getByText(/1 inscrição no Eventando passa/)).toBeInTheDocument();
    expect(screen.getByText(/desativada e anonimizada/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /wagdson.sd@x.io/ })).toBeChecked();
    expect(merged).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Juntar' }));
    await waitFor(() => expect(merged).toHaveBeenCalled());
    await waitFor(() => expect(onMerged).toHaveBeenCalledWith(expect.objectContaining({ keepUserId: '621' })));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Contas juntadas' }));
  });

  it('waits for the admin to pick the account that stays when there is no suggestion', async () => {
    renderDialog([previewMock('620', '621', { keep: preview().drop, drop: preview().keep })]);
    expect(screen.getByText('Escolha a conta que fica para ver o que muda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juntar' })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /wagdson.ope@x.io/ }));
    expect(await screen.findByTestId('merge-preview')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Juntar' })).toBeEnabled());
  });

  it('shows why it cannot join and keeps the button off', async () => {
    renderDialog([
      previewMock('621', '620', { canMerge: false, blockers: ['A conta descartada é Admin. Dê esse papel à conta que fica antes de juntar.'] }),
    ], { defaultKeepId: '621' });
    expect(await screen.findByText(/A conta descartada é Admin/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juntar' })).toBeDisabled();
  });

  it('in a bigger group, asks which account joins the one that stays', async () => {
    renderDialog([previewMock('621', '622')], {
      accounts: [...ACCOUNTS, { id: '622', name: 'W', email: 'w3@x.io' }],
      defaultKeepId: '621',
    });
    expect(screen.getByText('Qual conta juntar a ela?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juntar' })).toBeDisabled();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Conta descartada' })).getByRole('radio', { name: /w3@x.io/ }));
    expect(await screen.findByTestId('merge-preview')).toBeInTheDocument();
  });

  it('says so when the join is refused', async () => {
    const refused: MockedResponse = {
      request: { query: ADMIN_MERGE_USERS, variables: { keepUserId: '621', dropUserId: '620' } },
      result: { errors: [{ message: 'A conta descartada já foi juntada a outra.' } as never] },
    };
    const { onMerged } = renderDialog([previewMock('621', '620'), refused], { defaultKeepId: '621' });
    await screen.findByTestId('merge-preview');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Juntar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Juntar' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(onMerged).not.toHaveBeenCalled();
  });
});
