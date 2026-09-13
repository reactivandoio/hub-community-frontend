import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { EVENT_SIGNUPS, CHECKIN_SIGNUP, MANUAL_SIGNUP, EVENT_BATCHES } from '@/lib/queries';
import EventBadgePrinterPage from '../page';

// ─── Mocks ────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useParams: () => ({ eventSlug: 'react-summit' }),
}));

const mockPrintBadge = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/badge-print', () => ({
  printBadge: (data: unknown) => mockPrintBadge(data),
}));

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: () => <canvas data-testid="qr" />,
}));

vi.mock('@/components/animations', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ─── Fixtures ─────────────────────────────────────────────────────

const signup = (over: Partial<{ id: string; name: string; email: string; checked_in: boolean; checked_in_at: string | null }>) => ({
  id: 's1',
  name: 'Ana Souza',
  email: 'ana@x.io',
  phone_number: null,
  checked_in: false,
  checked_in_at: null,
  product_name: 'Ingresso',
  ...over,
});

const signupsMock = (list: ReturnType<typeof signup>[]): MockedResponse => ({
  request: { query: EVENT_SIGNUPS, variables: { eventSlug: 'react-summit' } },
  result: { data: { eventSignups: list } },
});

const batchesMock: MockedResponse = {
  request: { query: EVENT_BATCHES, variables: { slugOrId: 'react-summit' } },
  result: {
    data: {
      eventBySlugOrId: {
        id: 'e1',
        title: 'React Summit',
        products: [
          { id: 'p1', name: 'Ingresso', enabled: true, batches: [{ id: '3', batch_number: 1, value: 0, enabled: true }] },
        ],
      },
    },
  },
};

const renderPage = (mocks: MockedResponse[]) =>
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <EventBadgePrinterPage />
    </MockedProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ─── List ─────────────────────────────────────────────────────────

describe('EventBadgePrinterPage — list', () => {
  it('lists the event signups from the server and marks the checked-in ones', async () => {
    renderPage([batchesMock, signupsMock([signup({}), signup({ id: 's2', name: 'Bia Lima', email: 'bia@x.io', checked_in: true })])]);
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    const bia = screen.getByText('Bia Lima').closest('tr') as HTMLElement;
    expect(within(bia).getByText(/credenciad/i)).toBeInTheDocument();
    const ana = screen.getByText('Ana Souza').closest('tr') as HTMLElement;
    expect(within(ana).queryByText(/credenciad/i)).not.toBeInTheDocument();
  });

  it('filters the list by the search term', async () => {
    renderPage([batchesMock, signupsMock([signup({}), signup({ id: 's2', name: 'Bia Lima', email: 'bia@x.io' })])]);
    await screen.findByText('Ana Souza');
    await userEvent.type(screen.getByPlaceholderText(/buscar/i), 'bia');
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
    expect(screen.getByText('Bia Lima')).toBeInTheDocument();
  });
});

// ─── Print = check-in ─────────────────────────────────────────────

describe('EventBadgePrinterPage — print', () => {
  it('prints the badge with the page settings and checks the person in', async () => {
    const checkin: MockedResponse = {
      request: { query: CHECKIN_SIGNUP, variables: { eventSlug: 'react-summit', signupId: 's1' } },
      result: { data: { checkinSignup: { success: true, message: 'ok', signup: signup({ checked_in: true, checked_in_at: '2026-09-12T10:00:00.000Z' }) } } },
    };
    renderPage([batchesMock, signupsMock([signup({})]), checkin, signupsMock([signup({ checked_in: true })])]);
    const row = (await screen.findByText('Ana Souza')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: /imprimir/i }));
    await waitFor(() => expect(mockPrintBadge).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Ana Souza', logoText: 'COMUNIDADE' })));
    await waitFor(() => expect(within(row).getByText(/credenciad/i)).toBeInTheDocument());
  });
});

// ─── Walk-in ──────────────────────────────────────────────────────

describe('EventBadgePrinterPage — walk-in', () => {
  it('registers the person on the spot, prints and checks them in', async () => {
    const created = signup({ id: 's9', name: 'Caio Melo', email: 'caio@x.io' });
    const manual: MockedResponse = {
      request: {
        query: MANUAL_SIGNUP,
        variables: { eventSlug: 'react-summit', batchId: '3', input: { name: 'Caio Melo', email: 'caio@x.io' } },
      },
      result: { data: { manualSignup: { success: true, message: 'ok', account_created: true, signup: created } } },
    };
    const checkin: MockedResponse = {
      request: { query: CHECKIN_SIGNUP, variables: { eventSlug: 'react-summit', signupId: 's9' } },
      result: { data: { checkinSignup: { success: true, message: 'ok', signup: { ...created, checked_in: true } } } },
    };
    renderPage([batchesMock, signupsMock([]), manual, checkin, signupsMock([{ ...created, checked_in: true }])]);
    await screen.findByText(/nenhum inscrito/i);

    await userEvent.click(screen.getByRole('button', { name: /credenciar na hora/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/nome completo/i), 'Caio Melo');
    await userEvent.type(within(dialog).getByLabelText(/e-mail/i), 'caio@x.io');
    await userEvent.click(within(dialog).getByRole('button', { name: /inscrever e imprimir/i }));

    await waitFor(() => expect(mockPrintBadge).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Caio Melo' })));
    await waitFor(() => expect(screen.getByText('Caio Melo')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the server message when the signup fails and keeps the dialog open', async () => {
    const failing: MockedResponse = {
      request: {
        query: MANUAL_SIGNUP,
        variables: { eventSlug: 'react-summit', batchId: '3', input: { name: 'Caio Melo', email: 'caio@x.io' } },
      },
      result: { data: { manualSignup: { success: false, message: 'Lote esgotado.', account_created: false, signup: null } } },
    };
    renderPage([batchesMock, signupsMock([]), failing]);
    await screen.findByText(/nenhum inscrito/i);
    await userEvent.click(screen.getByRole('button', { name: /credenciar na hora/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/nome completo/i), 'Caio Melo');
    await userEvent.type(within(dialog).getByLabelText(/e-mail/i), 'caio@x.io');
    await userEvent.click(within(dialog).getByRole('button', { name: /inscrever e imprimir/i }));
    expect(await within(dialog).findByText('Lote esgotado.')).toBeInTheDocument();
    expect(mockPrintBadge).not.toHaveBeenCalled();
  });
});
