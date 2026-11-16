import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ADMIN_USER_EMAILS } from '@/lib/queries';
import type { AdminUserProfile } from '@/lib/types';

import { UserEmailsTab } from '../user-emails-tab';
import { UserProfileView } from '../user-profile-view';

const profile: AdminUserProfile = {
  id: '9',
  email: 'ana@x.io',
  name: 'Ana Souza',
  cpf_masked: '***.982.247-**',
  date_of_birth: '1990-05-17',
  blocked: false,
  registration_pending: false,
  role: { type: 'event-manager', name: 'Event Manager' },
  communities: [],
  events: [{ id: 'ev1', title: 'Meetup' }],
  adult_declaration: true,
  adult_declaration_at: '2026-11-01T13:00:00Z',
  signups: [{
    id: '42', event: { id: 'ev1', title: 'Meetup' }, product_name: 'Lote 1', payment_status: 'CONFIRMED', paid_cents: 5000,
    created_at: '2026-11-01T13:00:00Z', checked_in: false,
  }],
  certificates: [{ id: 'c1', code: 'RCT-ABCD1234', category: 'Participante', event: { id: 'ev1', title: 'Meetup' }, issued_at: '2026-11-10T13:00:00Z' }],
  attendances: null,
};

describe('UserProfileView (REA-52)', () => {
  it('shows the account, its role and what it manages, with the CPF masked', () => {
    render(<UserProfileView profile={profile} />);
    expect(screen.getByText('***.982.247-**')).toBeInTheDocument();
    expect(screen.getByText('17/05/1990')).toBeInTheDocument();
    expect(screen.getByText('Event Manager')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Meetup' })[0]).toHaveAttribute('href', '/admin/events/ev1');
  });

  it('lists signups with payment, certificates, and says when a source could not be read', () => {
    render(<UserProfileView profile={profile} />);
    const row = screen.getByRole('cell', { name: 'Lote 1' }).closest('tr') as HTMLElement;
    expect(within(row).getByText(/Pago · R\$\s?50,00/)).toBeInTheDocument();
    expect(screen.getByText(/RCT-ABCD1234/)).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível carregar agora/)).toBeInTheDocument();
  });
});

const emailsMock = (items: unknown[], total = items.length): MockedResponse => ({
  request: { query: ADMIN_USER_EMAILS, variables: { userId: '9', page: 1, pageSize: 20 } },
  result: { data: { adminUserEmails: { total, page: 1, pageSize: 20, items } } },
});

const email = (extra: Record<string, unknown>) => ({
  id: 'd1', kind: 'signup-confirmation', subject: '✅ Inscrição Confirmada — Meetup', status: 'sent', error: null,
  sent_at: '2026-11-15T13:00:00Z', message_id: 'm1', last_event: null, last_event_at: null, events: [], ...extra,
});

describe('UserEmailsTab (REA-52)', () => {
  it('lists each e-mail with its outcome and opens the Mailgun timeline', async () => {
    render(
      <MockedProvider mocks={[emailsMock([email({
        last_event: 'opened',
        events: [
          { event: 'delivered', at: '2026-11-15T13:00:05Z', severity: null, reason: null, message: null, url: null },
          { event: 'opened', at: '2026-11-15T14:00:00Z', severity: null, reason: null, message: null, url: null },
        ],
      })])]} addTypename={false}>
        <UserEmailsTab userId="9" />
      </MockedProvider>,
    );
    expect(await screen.findByText('✅ Inscrição Confirmada — Meetup')).toBeInTheDocument();
    expect(screen.getByText('Aberto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    const timeline = screen.getByRole('list', { name: 'Linha do tempo' });
    expect(within(timeline).getByText('Entregue')).toBeInTheDocument();
    expect(within(timeline).getByText('15/11/2026 11:00')).toBeInTheDocument();
  });

  it('shows why Mailgun refused one', async () => {
    render(
      <MockedProvider mocks={[emailsMock([email({ kind: 'login-code', subject: null, status: 'failed', error: '421 limit' })])]} addTypename={false}>
        <UserEmailsTab userId="9" />
      </MockedProvider>,
    );
    expect(await screen.findByText('Não enviado')).toBeInTheDocument();
    expect(screen.getAllByText(/Código de login/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(screen.getByText('Recusado pelo Mailgun: 421 limit')).toBeInTheDocument();
  });

  it('counts every e-mail of the address and never repeats the kind as the subtitle', async () => {
    render(
      <MockedProvider mocks={[emailsMock([
        email({ id: 'd1', kind: 'signup-confirmation-resend', subject: null, sent_at: '2026-11-16T02:03:00Z' }),
        email({ id: 'd2', kind: 'login-code', subject: 'Seu código de acesso: 123456', sent_at: '2026-11-16T01:37:00Z' }),
      ], 2)]} addTypename={false}>
        <UserEmailsTab userId="9" />
      </MockedProvider>,
    );
    expect(await screen.findByText(/^2 e-mails\./)).toBeInTheDocument();
    expect(screen.getAllByText('Inscrição confirmada (reenvio)')).toHaveLength(1);
    expect(screen.getByText('15/11/2026 23:03')).toBeInTheDocument();
    expect(screen.getByText('Seu código de acesso: 123456')).toBeInTheDocument();
    expect(screen.getByText(/Código de login ·/)).toBeInTheDocument();
  });

  it('says when nothing was sent', async () => {
    render(
      <MockedProvider mocks={[emailsMock([])]} addTypename={false}>
        <UserEmailsTab userId="9" />
      </MockedProvider>,
    );
    expect(await screen.findByText('Nenhum e-mail enviado a este usuário.')).toBeInTheDocument();
  });
});
