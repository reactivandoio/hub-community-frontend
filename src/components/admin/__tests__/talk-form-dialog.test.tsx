import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TalkFormDialog } from '../talk-form-dialog';
import {
  CREATE_SPEAKER,
  CREATE_TALK,
  GET_SPEAKER_OPTIONS,
  GET_SPEAKERS,
} from '@/lib/queries';
import { SPEAKER_PAGE_SIZE } from '@/lib/speaker-options';
import type { Speaker } from '@/lib/types';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: () => null,
}));

const firstPage: Speaker[] = Array.from({ length: SPEAKER_PAGE_SIZE }, (_, i) => ({
  id: `s${i}`,
  name: `Palestrante ${String(i).padStart(3, '0')}`,
  avatar: null as unknown as string,
}));
const lastSpeaker: Speaker = { id: 'z1', name: 'Zélia Última', avatar: null as unknown as string };

const pageMock = (page: number, data: Speaker[], delay = 0): MockedResponse => ({
  delay,
  request: {
    query: GET_SPEAKER_OPTIONS,
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

const speakerPages = (delay = 0) => [
  pageMock(1, firstPage, delay),
  pageMock(2, [lastSpeaker], delay),
];

// The list as the old modal asked for it (first page only), served twice: on
// open and on the refetch after creating a speaker. That refetch, without the
// new speaker (and, unsorted, in another order), is what used to drop it from the talk.
const legacyListMocks = (): MockedResponse[] => {
  const full = firstPage.map(s => ({ ...s, highlight: false, biography: null, talks: [] }));
  return [full, [...full].reverse()].map(data => ({
    request: { query: GET_SPEAKERS },
    result: { data: { speakers: { data, meta: null } } },
  }));
};

const renderDialog = (mocks: MockedResponse[], onSave = vi.fn()) => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <TalkFormDialog eventId="ev1" onSave={onSave} trigger={<button>Abrir</button>} />
    </MockedProvider>,
  );
  fireEvent.click(screen.getByText('Abrir'));
  return onSave;
};

const waitSpeakersLoaded = () =>
  waitFor(() =>
    expect(screen.getByRole('combobox')).toHaveTextContent('Adicionar um palestrante...'),
  );

describe('TalkFormDialog — speakers', () => {
  beforeEach(() => toast.mockClear());

  it('finds a speaker that is only on the second page of the server list', async () => {
    renderDialog(speakerPages());
    await waitSpeakersLoaded();

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByPlaceholderText('Adicionar um palestrante...'), {
      target: { value: 'Zélia' },
    });
    fireEvent.click(await screen.findByRole('option', { name: /Zélia Última/ }));

    expect(await screen.findByText('Zélia Última')).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('selects the speaker created with "Novo Palestrante" and sends it with the talk', async () => {
    const created = { id: 'new1', name: 'Recém Criada' };
    // The server list arrives after the speaker is created, and without them.
    const onSave = renderDialog([
      ...speakerPages(150),
      ...legacyListMocks(),
      {
        request: { query: CREATE_SPEAKER, variables: { data: { name: 'Recém Criada', biography: [] } } },
        result: { data: { createSpeaker: created } },
      },
      {
        request: {
          query: CREATE_TALK,
          variables: {
            data: {
              title: 'Soberania Digital',
              subtitle: '',
              description: [],
              speakers: ['new1'],
              occur_date: '2026-10-20T19:00:00',
              event: 'ev1',
              highlight: false,
            },
          },
        },
        result: { data: { createTalk: { id: 't1', title: 'Soberania Digital', speakers: [created] } } },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Novo Palestrante/ }));
    fireEvent.change(screen.getByPlaceholderText('Ex: João Silva'), {
      target: { value: 'Recém Criada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    // Back on the talk dialog, the new speaker is already selected.
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Ex: João Silva')).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Recém Criada')).toBeInTheDocument();

    // Still selected once the server list (without them) has loaded.
    await waitSpeakersLoaded();
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(screen.getByText('Recém Criada')).toBeInTheDocument();

    // …and can be found by the search.
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByPlaceholderText('Adicionar um palestrante...'), {
      target: { value: 'Recém' },
    });
    expect(await screen.findByRole('option', { name: /Recém Criada/ })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    fireEvent.change(screen.getByPlaceholderText('Título da palestra'), {
      target: { value: 'Soberania Digital' },
    });
    const date = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    fireEvent.change(date, { target: { value: '2026-10-20T19:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Palestra' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' })));
  });
});
