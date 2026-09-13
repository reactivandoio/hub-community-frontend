import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { ME, UPDATE_PROFILE } from '@/lib/queries';
import type { User } from '@/lib/types';
import { CompleteProfileModal } from '../complete-profile-modal';

// ─── Mocks ────────────────────────────────────────────────────────

const auth: { isAuthenticated: boolean; isLoading: boolean; user: User | null; syncUser: ReturnType<typeof vi.fn> } = {
  isAuthenticated: true,
  isLoading: false,
  user: null,
  syncUser: vi.fn(),
};

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => auth,
}));

const baseUser: User = { id: '9', email: 'ana@x.io', username: 'ana-4f2k' };

const meMock = (me: Partial<User> | null): MockedResponse => ({
  request: { query: ME },
  result: { data: { me: me ? { id: '9', username: 'ana-4f2k', email: 'ana@x.io', name: null, phone: null, cpf: null, date_of_birth: null, ...me } : null } },
});

const renderModal = (mocks: MockedResponse[]) =>
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <CompleteProfileModal />
    </MockedProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.isAuthenticated = true;
  auth.isLoading = false;
  auth.user = { ...baseUser };
  // Mirror the real syncUser so the modal sees the merged user.
  auth.syncUser.mockImplementation((data: Partial<User>) => {
    auth.user = { ...(auth.user as User), ...data };
  });
});

// ─── Visibility ───────────────────────────────────────────────────

describe('CompleteProfileModal — when to show', () => {
  it('renders nothing when not authenticated', () => {
    auth.isAuthenticated = false;
    auth.user = null;
    renderModal([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing when the stored profile is already complete', () => {
    auth.user = { ...baseUser, name: 'Ana Souza', cpf: '52998224725', date_of_birth: '1990-05-17' };
    renderModal([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('syncs the fresh profile from the server and stays closed when it is complete there', async () => {
    renderModal([meMock({ name: 'Ana Souza', cpf: '52998224725', date_of_birth: '1990-05-17' })]);
    await waitFor(() =>
      expect(auth.syncUser).toHaveBeenCalledWith({ name: 'Ana Souza', cpf: '52998224725', date_of_birth: '1990-05-17' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with only the missing fields after checking the server', async () => {
    renderModal([meMock({ name: 'Ana Souza' })]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByLabelText(/nome completo/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/cpf/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/data de nascimento/i)).toBeInTheDocument();
  });

  it('cannot be dismissed: no close button and Escape keeps it open', async () => {
    renderModal([meMock(null)]);
    const dialog = await screen.findByRole('dialog');
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
  });
});

// ─── Form ─────────────────────────────────────────────────────────

describe('CompleteProfileModal — form', () => {
  it('rejects an invalid CPF before calling the server', async () => {
    renderModal([meMock(null)]);
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByLabelText(/nome completo/i), 'Ana Souza');
    await userEvent.type(screen.getByLabelText(/cpf/i), '11111111111');
    await userEvent.type(screen.getByLabelText(/data de nascimento/i), '1990-05-17');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText(/cpf inválido/i)).toBeInTheDocument();
    expect(auth.syncUser).not.toHaveBeenCalledWith(expect.objectContaining({ cpf: expect.anything() }));
  });

  it('saves the missing fields, syncs the user and closes', async () => {
    const update: MockedResponse = {
      request: {
        query: UPDATE_PROFILE,
        variables: { input: { name: 'Ana Souza', cpf: '52998224725', date_of_birth: '1990-05-17' } },
      },
      result: { data: { updateProfile: { id: '9', username: 'ana-4f2k', email: 'ana@x.io', name: 'Ana Souza', phone: null, cover_photo: null, twitter: null, linkedin: null, github: null, website: null, instagram: null } } },
    };
    renderModal([meMock(null), update]);
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByLabelText(/nome completo/i), 'Ana Souza');
    await userEvent.type(screen.getByLabelText(/cpf/i), '529.982.247-25');
    await userEvent.type(screen.getByLabelText(/data de nascimento/i), '1990-05-17');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() =>
      expect(auth.syncUser).toHaveBeenCalledWith({ name: 'Ana Souza', cpf: '52998224725', date_of_birth: '1990-05-17' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the server error and stays open', async () => {
    const failing: MockedResponse = {
      request: { query: UPDATE_PROFILE, variables: { input: { name: 'Ana Souza', cpf: '52998224725', date_of_birth: '1990-05-17' } } },
      error: new Error('Error updating profile: boom'),
    };
    renderModal([meMock(null), failing]);
    await screen.findByRole('dialog');
    await userEvent.type(screen.getByLabelText(/nome completo/i), 'Ana Souza');
    await userEvent.type(screen.getByLabelText(/cpf/i), '52998224725');
    await userEvent.type(screen.getByLabelText(/data de nascimento/i), '1990-05-17');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
