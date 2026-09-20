import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { GET_EVENTS } from '@/lib/queries';
import EventsAdminPage from '../page';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const event = (id: string, title: string, unlisted: boolean) => ({
  __typename: 'Event',
  id,
  documentId: id,
  slug: title.toLowerCase(),
  title,
  description: null,
  start_date: '2026-10-01T12:00:00.000Z',
  end_date: '2026-10-01T18:00:00.000Z',
  images: [],
  unlisted,
  communities: [],
  talks: [],
  location: null,
});

// The admin listing is the one caller that asks for the hidden events, so the
// mock only matches when `include_unlisted` is in the variables.
const listMock: MockedResponse = {
  request: {
    query: GET_EVENTS,
    variables: { sort: [{ start_date: 'DESC' }], include_unlisted: true },
  },
  result: {
    data: {
      events: {
        __typename: 'PaginatedEvents',
        data: [event('e1', 'Meetup', false), event('e2', 'Interno', true)],
      },
    },
  },
};

describe('EventsAdminPage', () => {
  it('lists the unlisted events and marks them', async () => {
    await render(
      <MockedProvider mocks={[listMock]} addTypename={false}>
        <EventsAdminPage />
      </MockedProvider>,
    );

    expect(await screen.findByText('Interno')).toBeInTheDocument();
    expect(screen.getByText('Meetup')).toBeInTheDocument();
    expect(screen.getAllByText('Não listado')).toHaveLength(1);
  });
});
