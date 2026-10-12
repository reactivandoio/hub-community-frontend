import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EditEventPage from '../page';

const updateEvent = vi.fn();
const updateEventSale = vi.fn();
let paymentsV2: boolean | null = true;
let isAdmin = true;
let lastInitial: any = null;

const event = {
  id: 'ev1',
  slug: 'meetup',
  title: 'Meetup',
  start_date: '2026-11-01T10:00:00.000Z',
  end_date: '2026-11-01T12:00:00.000Z',
  max_slots: 10,
  products: [
    { id: 'p1', name: 'Ingresso', enabled: true, batches: [{ id: 'b1', batch_number: 1, value: 5090, enabled: true }] },
  ],
};

// Stable results, like Apollo's: a new `data` object per render would loop the
// page's useEffect([data]).
const refetch = vi.fn();
const eventResult = { data: { eventBySlugOrId: event }, loading: false, refetch };
const emptyResult = { data: undefined, loading: false };

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'meetup' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/use-payments-v2', () => ({ usePaymentsV2: () => paymentsV2 }));
vi.mock('@/components/admin/admin-guard', () => ({
  useAdminAccess: () => ({ isAdmin, isCommunityManager: !isAdmin, canAccessAdmin: true, role: isAdmin ? 'admin' : 'community-manager', communities: [] }),
}));
vi.mock('@/components/admin/coupons-tab', () => ({ CouponsTab: () => <div>Lista de cupons</div> }));
// Matched by operation name (importing @/lib/queries in the factory deadlocks).
vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  const name = (doc: any) => doc?.definitions?.[0]?.name?.value;
  return {
    ...actual,
    useQuery: (doc: any) => {
      if (name(doc) === 'GetEventBySlugOrId') return eventResult;
      if (name(doc) === 'EventPaymentSettings') throw new Error('eventPaymentSettings is no longer asked for');
      return emptyResult;
    },
    useMutation: (doc: any) =>
      name(doc) === 'UpdateEvent' ? [updateEvent, { loading: false }] : [updateEventSale, { loading: false }],
  };
});
vi.mock('@/components/admin/event-form', () => ({
  EventForm: ({ initialData, onSubmit }: any) => {
    lastInitial = initialData;
    return <button onClick={() => onSubmit(initialData)}>Salvar Evento</button>;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin = true;
  lastInitial = null;
  updateEvent.mockResolvedValue({ data: { updateEvent: { id: 'ev1' } } });
  updateEventSale.mockResolvedValue({ data: { updateEventSale: { id: 'ev1' } } });
});

describe('EditEventPage (REA-6 gating)', () => {
  it('with the new BFF: edits in reais, saves cents, shows the Cupons tab, sends no provider (REA-15)', async () => {
    paymentsV2 = true;
    render(<EditEventPage />);
    fireEvent.click(await screen.findByText('Salvar Evento'));
    expect(lastInitial.products[0].batches[0].value).toBe(50.9);
    await waitFor(() => expect(updateEventSale).toHaveBeenCalled());
    const data = updateEventSale.mock.calls[0][0].variables.data;
    expect(data.products[0].batches[0].value).toBe(5090);
    expect(data).not.toHaveProperty('payment_provider');
    expect(updateEvent.mock.calls[0][0].variables.data).not.toHaveProperty('pixai_token_integration');
    expect(screen.getByRole('tab', { name: 'Cupons' })).toBeInTheDocument();
  });

  it('with the old BFF: prices round-trip untouched, no Cupons tab', async () => {
    paymentsV2 = false;
    render(<EditEventPage />);
    fireEvent.click(await screen.findByText('Salvar Evento'));
    expect(lastInitial.products[0].batches[0].value).toBe(5090);
    await waitFor(() => expect(updateEventSale).toHaveBeenCalled());
    const data = updateEventSale.mock.calls[0][0].variables.data;
    expect(data.products[0].batches[0].value).toBe(5090);
    expect(data).not.toHaveProperty('payment_provider');
    expect(screen.queryByRole('tab', { name: 'Cupons' })).not.toBeInTheDocument();
  });

  it('community-manager: edits the event in reais, without the Cupons tab (admin only)', async () => {
    paymentsV2 = true;
    isAdmin = false;
    render(<EditEventPage />);
    fireEvent.click(await screen.findByText('Salvar Evento'));
    expect(lastInitial.products[0].batches[0].value).toBe(50.9);
    await waitFor(() => expect(updateEventSale).toHaveBeenCalled());
    const data = updateEventSale.mock.calls[0][0].variables.data;
    expect(data.products[0].batches[0].value).toBe(5090);
    expect(data).not.toHaveProperty('payment_provider');
    expect(screen.queryByRole('tab', { name: 'Cupons' })).not.toBeInTheDocument();
  });

  it('waits for the probe before loading the form', () => {
    paymentsV2 = null;
    render(<EditEventPage />);
    expect(screen.queryByText('Salvar Evento')).not.toBeInTheDocument();
  });
});
