import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SpeakersAdminPage from '../page';
import { GET_SPEAKERS } from '@/lib/queries';
import { SPEAKER_PAGE_SIZE } from '@/lib/speaker-options';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const row = (id: string, name: string) => ({
  id,
  name,
  avatar: null,
  highlight: false,
  biography: null,
  talks: [],
});

const firstPage = Array.from({ length: SPEAKER_PAGE_SIZE }, (_, i) =>
  row(`s${i}`, `Palestrante ${String(i).padStart(3, '0')}`),
);

const pageMock = (page: number, data: ReturnType<typeof row>[]): MockedResponse => ({
  request: {
    query: GET_SPEAKERS,
    variables: {
      sort: [{ name: 'ASC' }, { id: 'ASC' }],
      pagination: { page, pageSize: SPEAKER_PAGE_SIZE },
    },
  },
  result: {
    data: {
      speakers: {
        data,
        meta: { total: SPEAKER_PAGE_SIZE + 1, page, pageSize: SPEAKER_PAGE_SIZE, pageCount: 2 },
      },
    },
  },
});

describe('SpeakersAdminPage', () => {
  it('lists speakers beyond the first page and finds them ignoring accents', async () => {
    render(
      <MockedProvider
        mocks={[pageMock(1, firstPage), pageMock(2, [row('z1', 'Zélia Última')])]}
        addTypename={false}
      >
        <SpeakersAdminPage />
      </MockedProvider>,
    );

    expect(await screen.findByText(`${SPEAKER_PAGE_SIZE + 1} palestrantes cadastrados`)).toBeInTheDocument();
    expect(screen.getByText('Zélia Última')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar palestrante...'), {
      target: { value: 'zelia ultima' },
    });
    expect(screen.getByText('Zélia Última')).toBeInTheDocument();
    expect(screen.queryByText('Palestrante 000')).not.toBeInTheDocument();
  });
});
