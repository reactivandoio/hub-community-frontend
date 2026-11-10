import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EVENT_PAYMENTS, GET_EVENT_ANALYTICS, GET_EVENT_TRACKING_METRICS } from '@/lib/queries';

import EventAnalyticsPage from '../page';

const clientQuery = vi.fn();
vi.mock('@/lib/apollo-client', () => ({ getApolloClient: () => ({ query: clientQuery }) }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'meetup' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const signup = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ana Souza',
  email: 'ana@x.io',
  phone_number: '62999990000',
  created_at: '2026-11-01T12:00:00.000Z',
  product_name: 'Ingresso',
  checked_in: false,
  checked_in_at: null,
  origin: 'SITE',
  cpf: null,
  payment_status: null,
  paid_cents: null,
  coupon_code: null,
  ...overrides,
});

const analytics = (overrides: Record<string, unknown> = {}) => ({
  event_id: 'ev-1',
  event_title: 'Meetup',
  event_slug: 'meetup',
  total_signups: 14,
  free_signups: 2,
  paid_signups: 10,
  pending_paid_signups: 2,
  max_slots: 100,
  occupancy_percentage: 14,
  certificate_requests: 0,
  products_breakdown: [],
  signups_timeline: [{ date: '2026-11-01', count: 14 }],
  all_signups: [signup()],
  checked_in_count: 0,
  attendance_rate: null,
  day_of_signups: 0,
  day_of_signups_by_origin: [],
  signups_by_origin: [],
  checkins_timeline: [],
  ...overrides,
});

const analyticsMock = (data: ReturnType<typeof analytics>): MockedResponse => ({
  request: { query: GET_EVENT_ANALYTICS, variables: { slugOrId: 'meetup' } },
  result: { data: { eventAnalytics: data } },
});

const payments = Array.from({ length: 12 }, (_, i) => ({
  email: `p${i}@x.io`,
  name: null,
  status: i < 10 ? 'CONFIRMED' : 'PEDING_PAYMENT',
  value: 2000,
  expires_at: i < 10 ? null : '2999-01-01T00:00:00.000Z',
}));
const paymentsMock: MockedResponse = {
  request: { query: EVENT_PAYMENTS, variables: { slugOrId: 'meetup' } },
  result: { data: { eventPayments: payments } },
  maxUsageCount: 10,
};
const trackingMock: MockedResponse = {
  request: { query: GET_EVENT_TRACKING_METRICS, variables: { eventDocumentId: 'ev-1', period: 'all' } },
  result: {
    data: {
      eventTrackingMetrics: {
        total_visits: 0,
        unique_visitors: 0,
        signup_clicks: 0,
        share_clicks: 0,
        visits_by_day: [],
        visits_by_referrer: [],
      },
    },
  },
  maxUsageCount: 10,
};

const renderPage = (mocks: MockedResponse[]) =>
  render(
    <MockedProvider
      mocks={[...mocks, paymentsMock, trackingMock]}
      addTypename={false}
      // The app's client (lib/apollo-client) reports every poll and refetch.
      defaultOptions={{ watchQuery: { notifyOnNetworkStatusChange: true } }}
    >
      <EventAnalyticsPage />
    </MockedProvider>,
  );

const paidCard = () => screen.getByText('Inscrições Pagas').parentElement as HTMLElement;

describe('Event analytics page (REA-27)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts only confirmed payments as paid and shows the pending ones apart', async () => {
    renderPage([analyticsMock(analytics())]);
    await screen.findByText('Inscrições Pagas');
    expect(paidCard()).toHaveTextContent('10');
    await waitFor(() => expect(paidCard()).toHaveTextContent('R$ 200,00 arrecadados · +2 pendentes'));
  });

  it('keeps the page on screen while it refreshes, and shows when it last updated', async () => {
    renderPage([
      analyticsMock(analytics()),
      analyticsMock(analytics({ paid_signups: 11, pending_paid_signups: 1 })),
    ]);
    await screen.findByText('Inscrições Pagas');
    const before = paidCard();
    expect(screen.getByText(/Última atualização:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Atualizar/ }));

    // No skeleton while the refresh is in flight…
    expect(screen.queryByRole('status', { name: 'Carregando analytics' })).not.toBeInTheDocument();
    expect(screen.getByText('Inscrições Pagas')).toBeInTheDocument();
    // …and the same card, updated in place: nothing was unmounted.
    await waitFor(() => expect(paidCard()).toHaveTextContent('11'));
    expect(paidCard()).toBe(before);
  });

  it('keeps the last data when a refresh fails', async () => {
    renderPage([
      analyticsMock(analytics()),
      {
        request: { query: GET_EVENT_ANALYTICS, variables: { slugOrId: 'meetup' } },
        error: new Error('rede caiu'),
      },
    ]);
    await screen.findByText('Inscrições Pagas');

    fireEvent.click(screen.getByRole('button', { name: /Atualizar/ }));

    await screen.findByText(/não foi possível atualizar agora/);
    expect(screen.queryByText('Erro ao carregar analytics')).not.toBeInTheDocument();
    expect(paidCard()).toHaveTextContent('10');
  });
});

describe('Event analytics participants list (REA-28)', () => {
  it('shows what each person paid, the coupon and when it expired', async () => {
    renderPage([
      analyticsMock(
        analytics({
          all_signups: [
            signup({ email: 'pago@x.io', payment_status: 'CONFIRMED', paid_cents: 1500, coupon_code: 'MEETUP25' }),
            signup({ email: 'pendente@x.io', payment_status: 'PEDING_PAYMENT' }),
            signup({ email: 'expirado@x.io', payment_status: 'EXPIRED' }),
            signup({ email: 'gratis@x.io' }),
          ],
        }),
      ),
    ]);
    const row = async (email: string) => (await screen.findByText(email)).closest('tr') as HTMLElement;

    expect(await row('pago@x.io')).toHaveTextContent(/Pago.*R\$\s15,00.*MEETUP25/);
    const pending = await row('pendente@x.io');
    expect(pending).toHaveTextContent('Pendente');
    expect(pending).not.toHaveTextContent('R$');
    expect(await row('expirado@x.io')).toHaveTextContent('Expirado');
    const free = await row('gratis@x.io');
    expect(free).toHaveTextContent('Gratuito');
    expect(free).not.toHaveTextContent('R$');
  });
});

describe('Event analytics CSV (REA-28)', () => {
  it('exports Pagamento, Valor pago and Cupom for each participant', async () => {
    const list = [
      signup({ email: 'pago@x.io', payment_status: 'CONFIRMED', paid_cents: 1500, coupon_code: 'MEETUP25' }),
      signup({ email: 'expirado@x.io', payment_status: 'EXPIRED' }),
    ];
    clientQuery.mockResolvedValue({ data: { eventAnalytics: analytics({ all_signups: list }) } });
    let blob: Blob | undefined;
    const createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:csv';
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    renderPage([analyticsMock(analytics({ all_signups: list }))]);
    fireEvent.click(await screen.findByRole('button', { name: /Baixar CSV/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());

    const [header, paid, expired] = (await blob!.text()).replace(/^\uFEFF/, '').split('\n');
    expect(header).toBe('Nome,E-mail,CPF,WhatsApp,Produto,Pagamento,Valor pago,Cupom,Data de Inscrição');
    // The value has a comma, so the field is quoted.
    expect(paid).toMatch(/,Pago,"R\$\s15,00",MEETUP25,/);
    expect(expired).toMatch(/,Expirado,,,/);
    click.mockRestore();
  });
});
