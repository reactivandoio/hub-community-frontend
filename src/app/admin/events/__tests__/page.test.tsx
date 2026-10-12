import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InMemoryCache } from '@apollo/client';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { GET_EVENTS } from '@/lib/queries';
import EventsAdminPage from '../page';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const ADMIN = { role: 'admin', isAdmin: true, isCommunityManager: false, canAccessAdmin: true, communities: [] };
let access: any = ADMIN;
vi.mock('@/components/admin/admin-guard', () => ({ useAdminAccess: () => access }));

const event = (id: string, title: string, unlisted: boolean, communities: { id: string }[] = []) => ({
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
  communities,
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
  it('shows a community-manager only the events of its communities', async () => {
    access = { ...ADMIN, role: 'community-manager', isAdmin: false, isCommunityManager: true, communities: [{ id: 'c-1' }] };
    const mock: MockedResponse = {
      ...listMock,
      result: {
        data: {
          events: {
            data: [event('e1', 'Meu Meetup', false, [{ id: 'c-1' }]), event('e2', 'De Outra', false, [{ id: 'c-2' }])],
          },
        },
      },
    };
    try {
      await render(
        <MockedProvider mocks={[mock]} addTypename={false}>
          <EventsAdminPage />
        </MockedProvider>,
      );
      expect(await screen.findByText('Meu Meetup')).toBeInTheDocument();
      expect(screen.queryByText('De Outra')).not.toBeInTheDocument();
    } finally {
      access = ADMIN;
    }
  });

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

  // An event created on /admin/events/new must show up when the admin comes
  // back, even though the list is already in Apollo's cache.
  it('revalidates a cached list against the server', async () => {
    const cache = new InMemoryCache({ addTypename: false });
    cache.writeQuery({
      query: GET_EVENTS,
      variables: listMock.request.variables,
      data: { events: { data: [event('e1', 'Meetup', false)] } },
    });
    const withNewEvent: MockedResponse = {
      ...listMock,
      result: {
        data: {
          events: { data: [event('e3', 'Recém-criado', false), event('e1', 'Meetup', false)] },
        },
      },
    };

    await render(
      <MockedProvider mocks={[withNewEvent]} cache={cache} addTypename={false}>
        <EventsAdminPage />
      </MockedProvider>,
    );

    expect(await screen.findByText('Recém-criado')).toBeInTheDocument();
  });
});
