import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewEventPage from '../page';

const push = vi.fn();
const toast = vi.fn();
const createEvent = vi.fn();
const updateEventSale = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@apollo/client', async importOriginal => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  // Matched by operation name: importing @/lib/queries here would import this
  // very mock again and never resolve.
  return {
    ...actual,
    useMutation: (mutation: any) =>
      mutation?.definitions?.[0]?.name?.value === 'CreateEvent'
        ? [createEvent, { loading: false }]
        : [updateEventSale, { loading: false }],
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
        });
        if (id) onSaved?.(id);
      }}
    >
      Salvar Evento
    </button>
  ),
}));

beforeEach(() => vi.clearAllMocks());

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
});
