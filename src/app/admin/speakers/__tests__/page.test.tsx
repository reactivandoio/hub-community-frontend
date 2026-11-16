import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SpeakersAdminPage from '../page';
import { GET_ADMIN_SPEAKERS, SPEAKER_ACCOUNT_REVIEW } from '@/lib/queries';
import { SPEAKER_PAGE_SIZE } from '@/lib/speaker-options';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const row = (id: string, name: string, account: unknown = null) => ({
  id,
  name,
  avatar: null,
  highlight: false,
  biography: null,
  email: null,
  account,
  talks: [],
});

const firstPage = Array.from({ length: SPEAKER_PAGE_SIZE }, (_, i) =>
  row(`s${i}`, `Palestrante ${String(i).padStart(3, '0')}`),
);

const pageMock = (page: number, data: ReturnType<typeof row>[]): MockedResponse => ({
  request: {
    query: GET_ADMIN_SPEAKERS,
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

const ANA = { id: '2', documentId: 'u-ana', name: 'Ana Souza', email: 'ana@x.io' };

const reviewMock = (suggestions: unknown[] = []): MockedResponse => ({
  request: { query: SPEAKER_ACCOUNT_REVIEW },
  result: {
    data: {
      speakerAccountReview: {
        total: 3,
        withAccount: 1,
        withoutAccount: 2,
        withoutAccountWithTalks: 1,
        suggestions,
      },
    },
  },
});

describe('SpeakersAdminPage', () => {
  it('shows the account of each speaker, the counts and filters by account (REA-53)', async () => {
    const single = (data: ReturnType<typeof row>[]): MockedResponse => ({
      ...pageMock(1, data),
      result: { data: { speakers: { data, meta: { total: data.length, page: 1, pageSize: SPEAKER_PAGE_SIZE, pageCount: 1 } } } },
    });
    render(
      <MockedProvider
        mocks={[
          single([row('s1', 'Ana Souza', ANA), row('s2', 'Bruno Lima')]),
          reviewMock([{ reason: 'EMAIL', speakerId: 's2', speakerName: 'Bruno Lima', talks: 1, account: { id: '3', documentId: 'u-b', name: 'Bruno', email: 'bruno@x.io' } }]),
        ]}
        addTypename={false}
      >
        <SpeakersAdminPage />
      </MockedProvider>,
    );

    expect(await screen.findByTestId('speaker-account-s1')).toHaveTextContent('ana@x.io');
    expect(screen.getByText('Sem conta', { selector: 'div' })).toBeInTheDocument();
    expect(await screen.findByText('1 de 3 palestrantes têm conta vinculada')).toBeInTheDocument();
    expect(screen.getByText(/2 sem conta \(1 com palestras\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sugestões de vínculo \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Ana Souza' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sem conta' }));
    expect(screen.queryByText('Ana Souza', { selector: 'td' })).not.toBeInTheDocument();
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Com conta' }));
    expect(screen.getByText('Ana Souza', { selector: 'td' })).toBeInTheDocument();
    expect(screen.queryByText('Bruno Lima')).not.toBeInTheDocument();
  });

  it('lists speakers beyond the first page and finds them ignoring accents', async () => {
    render(
      <MockedProvider
        mocks={[pageMock(1, firstPage), pageMock(2, [row('z1', 'Zélia Última')]), reviewMock()]}
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
