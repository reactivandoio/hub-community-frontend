import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventEditor } from '../event-editor';
import { UnsavedGuardProvider, useUnsavedGuard } from '../unsaved-guard';

const updateEvent = vi.fn();
const updateEventSale = vi.fn();
const push = vi.fn();
const replace = vi.fn();
let pathname = '/admin/events/meetup';
let paymentsV2: boolean | null = true;
let lastInitial: any = null;
let lastFormProps: any = null;

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
// editor's useEffect([data]).
const refetch = vi.fn();
const eventResult = { data: { eventBySlugOrId: event }, loading: false, refetch };
const emptyResult = { data: undefined, loading: false };
const router = { push, replace };

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'meetup' }),
  usePathname: () => pathname,
  useRouter: () => router,
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/use-payments-v2', () => ({ usePaymentsV2: () => paymentsV2 }));
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
  EventForm: (props: any) => {
    lastInitial = props.initialData;
    lastFormProps = props;
    return <button onClick={() => props.onSubmit(props.initialData)}>Salvar Evento</button>;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  pathname = '/admin/events/meetup';
  window.history.replaceState({}, '', '/admin/events/meetup');
  lastInitial = null;
  lastFormProps = null;
  updateEvent.mockResolvedValue({ data: { updateEvent: { id: 'ev1' } } });
  updateEventSale.mockResolvedValue({ data: { updateEventSale: { id: 'ev1' } } });
});

describe('EventEditor (REA-6 gating)', () => {
  it('with the new BFF: edits in reais, saves cents, sends no provider (REA-15)', async () => {
    paymentsV2 = true;
    render(<EventEditor />);
    fireEvent.click(await screen.findByText('Salvar Evento'));
    expect(lastInitial.products[0].batches[0].value).toBe(50.9);
    await waitFor(() => expect(updateEventSale).toHaveBeenCalled());
    const data = updateEventSale.mock.calls[0][0].variables.data;
    expect(data.products[0].batches[0].value).toBe(5090);
    expect(data).not.toHaveProperty('payment_provider');
    expect(updateEvent.mock.calls[0][0].variables.data).not.toHaveProperty('pixai_token_integration');
  });

  it('with the old BFF: prices round-trip untouched', async () => {
    paymentsV2 = false;
    render(<EventEditor />);
    fireEvent.click(await screen.findByText('Salvar Evento'));
    expect(lastInitial.products[0].batches[0].value).toBe(5090);
    await waitFor(() => expect(updateEventSale).toHaveBeenCalled());
    const data = updateEventSale.mock.calls[0][0].variables.data;
    expect(data.products[0].batches[0].value).toBe(5090);
    expect(data).not.toHaveProperty('payment_provider');
  });

  it('waits for the probe before loading the form', () => {
    paymentsV2 = null;
    render(<EventEditor />);
    expect(screen.queryByText('Salvar Evento')).not.toBeInTheDocument();
  });
});

describe('EventEditor (REA-24 sections by URL)', () => {
  beforeEach(() => {
    paymentsV2 = true;
  });

  it('shows the part of the form the URL names', async () => {
    render(<EventEditor />);
    await screen.findByText('Salvar Evento');
    expect(lastFormProps.section).toBe('general');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Geral');
  });

  it('keeps the same form, with what was typed, when the URL changes section', async () => {
    const { rerender } = render(<EventEditor />);
    await screen.findByText('Salvar Evento');
    const formBefore = screen.getByText('Salvar Evento');

    pathname = '/admin/events/meetup/programacao';
    rerender(<EventEditor />);
    expect(lastFormProps.section).toBe('schedule');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Programação');
    // Same DOM node: the form was not remounted.
    expect(screen.getByText('Salvar Evento')).toBe(formBefore);

    pathname = '/admin/events/meetup/produtos';
    rerender(<EventEditor />);
    expect(lastFormProps.section).toBe('products');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Produtos & Lotes');
  });

  it('goes to the URL of the section the form asks for (a validation error there)', async () => {
    render(<EventEditor />);
    await screen.findByText('Salvar Evento');
    lastFormProps.onSectionChange('products');
    expect(push).toHaveBeenCalledWith('/admin/events/meetup/produtos');
  });

  it('redirects the old links with a fragment', async () => {
    window.history.replaceState({}, '', '/admin/events/meetup#products');
    render(<EventEditor />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/events/meetup/produtos'));
  });

  it('redirects #schedule too, and leaves other fragments alone', async () => {
    window.history.replaceState({}, '', '/admin/events/meetup#schedule');
    const { unmount } = render(<EventEditor />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/events/meetup/programacao'));
    unmount();

    replace.mockClear();
    window.history.replaceState({}, '', '/admin/events/meetup#outra-coisa');
    render(<EventEditor />);
    await screen.findByText('Salvar Evento');
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('EventEditor (REA-24 unsaved changes)', () => {
  let guard: ReturnType<typeof useUnsavedGuard>;
  function Probe() {
    guard = useUnsavedGuard();
    return null;
  }
  const renderGuarded = () =>
    render(
      <UnsavedGuardProvider>
        <Probe />
        <EventEditor />
      </UnsavedGuardProvider>,
    );

  beforeEach(() => {
    paymentsV2 = true;
  });

  it('lets any link through while nothing changed', async () => {
    renderGuarded();
    await screen.findByText('Salvar Evento');
    expect(guard.request('/admin/events/meetup/analytics')).toBe(true);
  });

  it('with changes: free between the form sections, asks for anything else', async () => {
    renderGuarded();
    await screen.findByText('Salvar Evento');
    act(() => lastFormProps.onDirtyChange(true));

    expect(guard.request('/admin/events/meetup/programacao')).toBe(true);
    expect(guard.request('/admin/events/meetup/produtos')).toBe(true);
    expect(guard.request('/admin/events/meetup')).toBe(true);

    let allowed = true;
    act(() => {
      allowed = guard.request('/admin/events/meetup/cupons');
    });
    expect(allowed).toBe(false);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Sair sem salvar?');
  });

  it('asks before going to another event or back to the admin', async () => {
    renderGuarded();
    await screen.findByText('Salvar Evento');
    act(() => lastFormProps.onDirtyChange(true));
    let other = true;
    let list = true;
    act(() => {
      other = guard.request('/admin/events/outro');
      list = guard.request('/admin/events');
    });
    expect(other).toBe(false);
    expect(list).toBe(false);
  });

  it('warns the browser on reload or close, only while there are changes', async () => {
    renderGuarded();
    await screen.findByText('Salvar Evento');
    const fire = () => {
      const unload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unload);
      return unload.defaultPrevented;
    };
    expect(fire()).toBe(false);
    act(() => lastFormProps.onDirtyChange(true));
    expect(fire()).toBe(true);
    act(() => lastFormProps.onDirtyChange(false));
    expect(fire()).toBe(false);
    expect(guard.request('/admin/events/meetup/analytics')).toBe(true);
  });
});
