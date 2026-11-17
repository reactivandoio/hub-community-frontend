import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ADMIN_DUPLICATE_CPF_GROUPS } from '@/lib/queries';

import { DuplicateCpfGroups } from '../duplicate-cpf-groups';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/admin/unsaved-guard', () => ({
  GuardedLink: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

const user = (id: string, email: string, over: Record<string, unknown> = {}) => ({
  id,
  name: 'Wagdson',
  email,
  created_at: '2026-11-13T03:31:23.335Z',
  last_login_at: null,
  blocked: false,
  role: 'authenticated',
  isAdmin: false,
  isManager: false,
  signups: 0,
  certificates: 0,
  links: 1,
  linkDetails: [],
  ...over,
});

const groupsMock = (groups: unknown[]): MockedResponse => ({
  request: { query: ADMIN_DUPLICATE_CPF_GROUPS },
  result: { data: { adminDuplicateCpfGroups: { total: groups.length, groups } } },
});

describe('DuplicateCpfGroups (REA-96)', () => {
  it('lists each group with what every account has and the suggestion, never the CPF', async () => {
    render(
      <MockedProvider addTypename={false} mocks={[groupsMock([{
        id: '620-621',
        suggestedKeepId: '621',
        suggestionReason: 'Mesmos vínculos; entrou por último.',
        users: [
          user('620', 'wagdson.ope@x.io', { signups: 1 }),
          user('621', 'wagdson.sd@x.io', { last_login_at: '2026-11-16T10:29:32.516Z' }),
        ],
      }])]}
      >
        <DuplicateCpfGroups />
      </MockedProvider>,
    );
    const group = await screen.findByTestId('duplicate-group-620-621');
    expect(within(group).getByText('Mesmos vínculos; entrou por último.')).toBeInTheDocument();
    const keepRow = within(group).getByText(/wagdson.sd@x.io/).closest('tr')!;
    expect(within(keepRow).getByText('Sugerida para ficar')).toBeInTheDocument();
    expect(within(group).getByText('Nunca')).toBeInTheDocument();
    expect(group.textContent).not.toMatch(/CPF:/);

    fireEvent.click(within(group).getByRole('button', { name: /Juntar/ }));
    expect(await screen.findByText('Juntar contas')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /wagdson.sd@x.io/ })).toBeChecked();
  });

  it('says when there is nothing to join', async () => {
    render(
      <MockedProvider addTypename={false} mocks={[groupsMock([])]}>
        <DuplicateCpfGroups />
      </MockedProvider>,
    );
    expect(await screen.findByText(/Nenhum CPF duplicado/)).toBeInTheDocument();
  });
});
