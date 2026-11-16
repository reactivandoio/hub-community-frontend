import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SpeakerAccountSection, SpeakerEditDialog, linkedToast } from '@/components/admin/speaker-edit-dialog';
import {
  LINK_SPEAKER_ACCOUNT,
  SPEAKER_ACCOUNT_SEARCH,
  UNLINK_SPEAKER_ACCOUNT,
  UPDATE_SPEAKER,
} from '@/lib/queries';
import { filterByAccount } from '@/lib/speaker-accounts';
import type { Speaker } from '@/lib/types';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const SPEAKER: Speaker = { id: 's1', name: 'Ana Souza', highlight: false, biography: undefined, account: null };
const ANA = { id: '2', documentId: 'u-ana', username: 'ana', name: 'Ana Souza', email: 'ana@x.io', blocked: false };

const searchMock: MockedResponse = {
  request: { query: SPEAKER_ACCOUNT_SEARCH, variables: { search: 'ana' } },
  result: {
    data: {
      adminUsers: {
        total: 2,
        items: [ANA, { id: '9', documentId: 'u-x', username: 'anab', name: 'Ana B', email: 'anab@x.io', blocked: true }],
      },
    },
  },
};

beforeEach(() => vi.clearAllMocks());

describe('SpeakerAccountSection (REA-53)', () => {
  it('searches accounts and links one; blocked accounts cannot be linked', async () => {
    const onChanged = vi.fn();
    const linkMock: MockedResponse = {
      request: { query: LINK_SPEAKER_ACCOUNT, variables: { speakerId: 's1', userId: '2' } },
      result: { data: { linkSpeakerAccount: { joined: ['Ana'], speaker: { id: 's1' } } } },
    };
    render(
      <MockedProvider mocks={[searchMock, linkMock]} addTypename={false}>
        <SpeakerAccountSection speaker={SPEAKER} onChanged={onChanged} />
      </MockedProvider>,
    );
    fireEvent.change(screen.getByLabelText('Vincular a uma conta'), { target: { value: 'ana' } });
    const button = await screen.findByRole('button', { name: 'Vincular a ana@x.io' }, { timeout: 2000 });
    expect(screen.getByText('Desativada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vincular a anab@x.io' })).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(await screen.findByTestId('speaker-account')).toHaveTextContent('ana@x.io');
    expect(onChanged).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Vinculado a Ana Souza.',
      description: expect.stringContaining('(Ana) foi juntado'),
    }));
  });

  it('shows the refusal of the BFF', async () => {
    const linkMock: MockedResponse = {
      request: { query: LINK_SPEAKER_ACCOUNT, variables: { speakerId: 's1', userId: '2' } },
      result: { errors: [{ message: 'ana@x.io já é o palestrante "Ana", com 2 palestras.' } as never] },
    };
    render(
      <MockedProvider mocks={[searchMock, linkMock]} addTypename={false}>
        <SpeakerAccountSection speaker={SPEAKER} onChanged={vi.fn()} />
      </MockedProvider>,
    );
    fireEvent.change(screen.getByLabelText('Vincular a uma conta'), { target: { value: 'ana' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Vincular a ana@x.io' }, { timeout: 2000 }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'ana@x.io já é o palestrante "Ana", com 2 palestras.',
    }));
    expect(screen.queryByTestId('speaker-account')).not.toBeInTheDocument();
  });

  it('unlinks after a confirmation', async () => {
    const onChanged = vi.fn();
    const unlinkMock: MockedResponse = {
      request: { query: UNLINK_SPEAKER_ACCOUNT, variables: { speakerId: 's1' } },
      result: { data: { unlinkSpeakerAccount: { id: 's1' } } },
    };
    render(
      <MockedProvider mocks={[unlinkMock]} addTypename={false}>
        <SpeakerAccountSection speaker={{ ...SPEAKER, account: ANA }} onChanged={onChanged} />
      </MockedProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Desvincular/ }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByLabelText('Vincular a uma conta')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('SpeakerEditDialog (REA-53)', () => {
  it('saves name and highlight, without the biography when it was not edited', async () => {
    const onChanged = vi.fn();
    const onOpenChange = vi.fn();
    const updateMock: MockedResponse = {
      request: { query: UPDATE_SPEAKER, variables: { id: 's1', data: { name: 'Ana S. Souza', highlight: true } } },
      result: { data: { updateSpeaker: { id: 's1', name: 'Ana S. Souza', avatar: null, highlight: true, biography: null } } },
    };
    render(
      <MockedProvider mocks={[updateMock]} addTypename={false}>
        <SpeakerEditDialog speaker={{ ...SPEAKER, biography: 'texto antigo' }} onOpenChange={onOpenChange} onChanged={onChanged} />
      </MockedProvider>,
    );
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana S. Souza' } });
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast).toHaveBeenCalledWith({ title: 'Palestrante atualizado.' });
  });
});

describe('speaker accounts helpers (REA-53)', () => {
  it('filters by account and words the link toast', () => {
    const list: Speaker[] = [{ id: 'a', name: 'A', account: ANA }, { id: 'b', name: 'B', account: null }];
    expect(filterByAccount(list, 'linked').map(s => s.id)).toEqual(['a']);
    expect(filterByAccount(list, 'unlinked').map(s => s.id)).toEqual(['b']);
    expect(filterByAccount(list, 'all')).toHaveLength(2);
    expect(linkedToast({ name: null, email: 'x@x.io' })).toEqual({ title: 'Vinculado a x@x.io.', description: undefined });
  });
});
