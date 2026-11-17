import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ADMIN_DUPLICATE_CPF_GROUPS, ADMIN_MERGE_PREVIEW, ADMIN_MERGE_USERS } from '@/lib/queries';
import type { AdminUserProfile } from '@/lib/types';

import { UserMergeButton } from '../user-merge-button';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/use-debounce', () => ({ useDebounce: (value: unknown) => value }));

const profile: AdminUserProfile = {
  id: '620', name: 'Wagdson', email: 'wagdson.ope@x.io', communities: [], events: [],
};

const mergeUser = (id: string, email: string) => ({
  id, name: 'Wagdson', email, created_at: null, last_login_at: null, blocked: false, role: 'authenticated',
  isAdmin: false, isManager: false, signups: 0, certificates: 0, links: 1, linkDetails: [],
});

const mocks: MockedResponse[] = [
  {
    request: { query: ADMIN_DUPLICATE_CPF_GROUPS },
    result: {
      data: {
        adminDuplicateCpfGroups: {
          total: 1,
          groups: [{
            id: '620-621',
            suggestedKeepId: '621',
            suggestionReason: 'Mesmos vínculos; entrou por último.',
            users: [mergeUser('620', 'wagdson.ope@x.io'), mergeUser('621', 'wagdson.sd@x.io')],
          }],
        },
      },
    },
  },
  {
    request: { query: ADMIN_MERGE_PREVIEW, variables: { keepUserId: '621', dropUserId: '620' } },
    result: {
      data: {
        adminMergePreview: {
          keep: { id: '621', name: 'Wagdson', email: 'wagdson.sd@x.io', role: 'authenticated', blocked: false },
          drop: { id: '620', name: 'Wagdson', email: 'wagdson.ope@x.io', role: 'authenticated', blocked: false },
          blockers: [], canMerge: true, links: [], certificatesByEmail: 0, requestsByEmail: 0, filledFields: [],
          signupsToMove: 1, signupConflicts: 0,
        },
      },
    },
  },
  {
    request: { query: ADMIN_MERGE_USERS, variables: { keepUserId: '621', dropUserId: '620' } },
    result: {
      data: {
        adminMergeUsers: {
          keepUserId: '621', linksMoved: [], certificatesByEmail: 0, requestsByEmail: 0, filledFields: [],
          signupsMoved: 1, signupsKept: 0, signupsFailed: 0, recorded: true, message: 'Contas juntadas.',
        },
      },
    },
  },
];

describe('UserMergeButton (REA-96)', () => {
  it('offers the account with the same CPF, keeps the suggested one and goes to it after joining', async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <UserMergeButton profile={profile} />
      </MockedProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Juntar com outra conta/ }));
    expect(await screen.findByText('Com o mesmo CPF')).toBeInTheDocument();
    expect(screen.getByText('Sugerida para ficar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /wagdson.sd@x.io/ }));

    expect(await screen.findByText('Juntar contas')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /wagdson.sd@x.io/ })).toBeChecked();
    await screen.findByTestId('merge-preview');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Juntar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Juntar' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/usuarios/621'));
  });
});
