import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewEventPage from '../page';

const push = vi.fn();
const toast = vi.fn();
const createEvent = vi.fn();
const updateEventSale = vi.fn();
const connect = vi.fn();
let extra: Record<string, unknown> = {};
let paymentsV2: boolean | null = false;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/use-payments-v2', () => ({ usePaymentsV2: () => paymentsV2 }));
vi.mock('@apollo/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  // Matched by operation name: importing @/lib/queries here would import this
  // very mock again and never resolve.
  return {
    ...actual,
    useMutation: (mutation: any) => {
      const name = mutation?.definitions?.[0]?.name?.value;
      if (name === 'CreateEvent') return [createEvent, { loading: false }];
      if (name === 'ConnectEventOpaPingou') return [connect, { loading: false }];
      return [updateEventSale, { loading: false }];
    },
  };
});

// The real form is exercised in its own test; here it only plays its contract:
// submit the values (with the id of the cover it just uploaded) and, when that
// returns an id, report the save through onSaved.
vi.mock('@/components/admin/event-form', () => ({
  EventForm: ({
    onSubmit,
    onSaved,
  }: {
    onSubmit: (data: any) => Promise<string | undefined>;
    onSaved?: (id: string) => void;
  }) => (
    <button
      onClick={async () => {
        const id = await onSubmit({
          title: 'Meetup',
          slug: 'meetup',
          start_date: '2026-11-01T10:00',
          end_date: '2026-11-01T12:00',
          max_slots: 10,
          images: ['42'],
          pixai_token_integration: 'old-token',
          payment_provider: 'pixai',
          products: [{ name: 'Ingresso', enabled: true, batches: [{ batch_number: 1, value: '50.9' }] }],
          ...extra,
        });
        if (id) onSaved?.(id);
      }}
    >
      Salvar Evento
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  extra = {};
  paymentsV2 = false;
  updateEventSale.mockResolvedValue({ data: { updateEventSale: { id: 'evt-1' } } });
});

describe('NewEventPage', () => {
  it('sends the uploaded cover and opens the created event for editing', async () => {
    createEvent.mockResolvedValue({ data: { createEvent: { id: 'evt-1' } } });

    render(<NewEventPage />);
    fireEvent.click(screen.getByText('Salvar Evento'));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/admin/events/evt-1')
    );
    expect(createEvent.mock.calls[0][0].variables.data.images).toEqual(['42']);
  });

  it('stays on the form when the event could not be created', async () => {
    createEvent.mockRejectedValue(new Error('boom'));

    render(<NewEventPage />);
    fireEvent.click(screen.getByText('Salvar Evento'));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      )
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps batch prices as typed while the BFF is the old one', async () => {
    createEvent.mockResolvedValue({ data: { createEvent: { id: 'evt-1' } } });
    render(<NewEventPage />);
    fireEvent.click(screen.getByText('Salvar Evento'));
    await waitFor(() => expect(updateEventSale).toHaveBeenCalled());
    const data = updateEventSale.mock.calls[0][0].variables.data;
    expect(data.products[0].batches[0].value).toBe(50.9);
    expect(data).not.toHaveProperty('payment_provider');
  });

  it('sends cents once the BFF has REA-6, and never a provider nor a Pix Aí token (REA-15)', async () => {
    paymentsV2 = true;
    createEvent.mockResolvedValue({ data: { createEvent: { id: 'evt-1' } } });
    render(<NewEventPage />);
    fireEvent.click(screen.getByText('Salvar Evento'));
    await waitFor(() => expect(updateEventSale).toHaveBeenCalled());
    const data = updateEventSale.mock.calls[0][0].variables.data;
    expect(data.products[0].batches[0].value).toBe(5090);
    expect(data).not.toHaveProperty('payment_provider');
    expect(createEvent.mock.calls[0][0].variables.data).not.toHaveProperty('pixai_token_integration');
  });
});

describe('NewEventPage: conta Opa Pingou (REA-12)', () => {
  const KEY = `opk_live_${'k'.repeat(43)}`;

  it('cria o evento, conecta a chave e só então salva os lotes', async () => {
    const order: string[] = [];
    createEvent.mockImplementation(async () => (order.push('create'), { data: { createEvent: { id: 'evt-1' } } }));
    connect.mockImplementation(async () => (order.push('connect'), { data: {} }));
    updateEventSale.mockImplementation(async () => (order.push('lots'), { data: { updateEventSale: { id: 'evt-1' } } }));
    extra = { opaPingouApiKey: KEY };
    render(<NewEventPage />);
    fireEvent.click(screen.getByText('Salvar Evento'));
    await waitFor(() => expect(order).toEqual(['create', 'connect', 'lots']));
    expect(connect).toHaveBeenCalledWith({ variables: { eventId: 'evt-1', apiKey: KEY } });
  });

  it('conexão recusada com lote pago: não tenta salvar os lotes e explica', async () => {
    createEvent.mockResolvedValue({ data: { createEvent: { id: 'evt-1' } } });
    connect.mockRejectedValue({ graphQLErrors: [{ message: 'O Opa Pingou não reconheceu esta chave.', extensions: { code: 'OPAPINGOU_INVALID_KEY' } }] });
    extra = { opaPingouApiKey: KEY };
    render(<NewEventPage />);
    fireEvent.click(screen.getByText('Salvar Evento'));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Evento criado, sem a conta Opa Pingou' }))
    );
    expect(updateEventSale).not.toHaveBeenCalled();
  });

  it('BFF recusa lote pago sem conta: o aviso diz o que fazer', async () => {
    createEvent.mockResolvedValue({ data: { createEvent: { id: 'evt-1' } } });
    updateEventSale.mockRejectedValue({ graphQLErrors: [{ message: 'x', extensions: { code: 'OPAPINGOU_ACCOUNT_REQUIRED' } }] });
    render(<NewEventPage />);
    fireEvent.click(screen.getByText('Salvar Evento'));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/conecte a conta Opa Pingou/) }))
    );
  });
});
