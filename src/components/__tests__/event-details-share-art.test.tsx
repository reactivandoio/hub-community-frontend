import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventDetails } from '../event-details';

const routerPush = vi.fn();

const event: Record<string, unknown> = {
  id: 'ev1',
  documentId: 'ev1',
  slug: 'meetup',
  title: 'Meetup',
  description: '',
  start_date: '2026-11-01T10:00:00.000Z',
  end_date: '2026-11-01T12:00:00.000Z',
  images: [],
  talks: [],
  communities: [],
  products: [
    { id: 'p1', name: 'Ingresso', enabled: true, batches: [{ id: 'b1', batch_number: 1, value: 5000, enabled: true }] },
  ],
};

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/hooks/use-tracking', () => ({
  useTracking: () => ({ track: vi.fn() }),
  usePageVisitTracker: () => undefined,
}));
vi.mock('@/lib/analytics', () => ({ trackViewEventDetail: vi.fn() }));
vi.mock('@/components/add-to-calendar-button', () => ({ AddToCalendarButton: () => null }));
vi.mock('@/components/talk-card', () => ({ TalkCard: () => null }));
vi.mock('@/components/ui/expandable-rich-text', () => ({ ExpandableRichText: () => null }));
// Matched by operation name, like the signup page test.
vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  const name = (doc: any) => doc?.definitions?.[0]?.name?.value;
  return {
    ...actual,
    useQuery: (doc: any) =>
      name(doc) === 'GetEventBySlugOrId'
        ? { data: { eventBySlugOrId: event }, loading: false }
        : { data: undefined, loading: false, refetch: vi.fn() },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  delete event.share_art_open;
  window.localStorage.clear();
  window.history.replaceState(null, '', '/events/meetup');
});

// REA-45: the organizer opened the "eu vou" art to people who are not signed up.
describe('EventDetails (REA-45 arte para não inscritos)', () => {
  it('offers the art to a visitor who is not signed up when the event opened it', () => {
    event.share_art_open = true;
    render(<EventDetails slugOrId="meetup" />);
    fireEvent.click(screen.getByRole('button', { name: /Gerar arte "eu vou"/ }));
    expect(routerPush).toHaveBeenCalledWith('/events/meetup/arte');
  });

  it('keeps the page as before when the event did not open it', () => {
    render(<EventDetails slugOrId="meetup" />);
    expect(screen.queryByRole('button', { name: /Gerar arte/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Participar do Evento/ })).toBeInTheDocument();
  });
});
