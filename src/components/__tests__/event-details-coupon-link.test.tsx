import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventDetails } from '../event-details';

const routerPush = vi.fn();

const event = {
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
  window.localStorage.clear();
  window.history.replaceState(null, '', '/events/meetup');
});

describe('EventDetails (REA-18 cupom pelo link)', () => {
  it('announces the coupon of the link and takes it to the signup', async () => {
    window.history.replaceState(null, '', '/events/meetup#cupom=promo10');
    render(<EventDetails slugOrId="meetup" />);
    expect(await screen.findByTestId('link-coupon-notice')).toHaveTextContent(
      'Cupom PROMO10 será aplicado na inscrição.',
    );
    fireEvent.click(screen.getByRole('button', { name: /Participar do Evento/ }));
    expect(routerPush).toHaveBeenCalledWith('/events/meetup/signup#cupom=PROMO10');
    expect(window.localStorage.getItem('pending_coupon:meetup')).toContain('PROMO10');
  });

  it('goes to the signup as before without a coupon, or with another fragment', () => {
    window.history.replaceState(null, '', '/events/meetup#agenda');
    render(<EventDetails slugOrId="meetup" />);
    expect(screen.queryByTestId('link-coupon-notice')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Participar do Evento/ }));
    expect(routerPush).toHaveBeenCalledWith('/events/meetup/signup');
    expect(window.location.hash).toBe('#agenda');
  });
});
