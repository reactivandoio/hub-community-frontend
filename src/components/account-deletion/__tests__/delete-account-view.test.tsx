import { ApolloError } from '@apollo/client';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeleteAccountView } from '../delete-account-view';
import { DELETE_MY_ACCOUNT, MY_SIGNUPS } from '@/lib/queries';

interface AuthMock {
  isAuthenticated: boolean;
  isHydrated: boolean;
  user: { email: string } | null;
  requestLoginCode: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
}

let auth: AuthMock;
const requestLogin = vi.fn();

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/contexts/login-prompt-context', () => ({ useLoginPrompt: () => ({ requestLogin }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const signupsMock = (mySignups: unknown[]): MockedResponse => ({
  request: { query: MY_SIGNUPS },
  result: { data: { mySignups } },
});

const signupsMissing: MockedResponse = {
  request: { query: MY_SIGNUPS },
  result: { errors: [new GraphQLError('Cannot query field "mySignups" on type "Query".')] },
};

const deleteOk: MockedResponse = {
  request: { query: DELETE_MY_ACCOUNT, variables: { code: '123456' } },
  result: { data: { deleteMyAccount: { __typename: 'DeleteMyAccountResult', success: true, message: null } } },
};

const deleteWrongCode: MockedResponse = {
  request: { query: DELETE_MY_ACCOUNT, variables: { code: '000000' } },
  result: {
    errors: [
      new GraphQLError('Código incorreto. Você tem mais 4 tentativas.', {
        extensions: { code: 'LOGIN_CODE_INVALID', attemptsLeft: 4 },
      }),
    ],
  },
};

const FUTURE = {
  __typename: 'MySignup',
  id: 'sig-1',
  product_name: 'Lote 1',
  payment_status: 'CONFIRMED',
  holds_place: true,
  event: {
    __typename: 'MySignupEvent',
    id: 'ev-1',
    slug: 'meetup',
    title: 'Meetup React',
    start_date: '2099-03-10T22:00:00.000Z',
    end_date: '2099-03-11T01:00:00.000Z',
  },
};

const renderView = (mocks: MockedResponse[] = []) =>
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <DeleteAccountView />
    </MockedProvider>
  );

const signedIn = () => {
  auth = { ...auth, isAuthenticated: true, user: { email: 'maria@exemplo.com' } };
};

const typeCodeAndConfirm = async (code: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Enviar código/ }));
  const input = await screen.findByLabelText('Código');
  fireEvent.change(input, { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: /Excluir minha conta/ }));
};

beforeEach(() => {
  vi.clearAllMocks();
  auth = {
    isAuthenticated: false,
    isHydrated: true,
    user: null,
    requestLoginCode: vi.fn().mockResolvedValue({ resendIn: 60 }),
    signOut: vi.fn(),
  };
});

describe('/excluir-conta (REA-65)', () => {
  it('signed out: explains what is deleted and kept and opens the login in place', () => {
    renderView();
    expect(screen.getByText('O que é apagado')).toBeInTheDocument();
    expect(screen.getByText('O que fica, e por quê')).toBeInTheDocument();
    expect(screen.getByText('Entre para excluir sua conta')).toBeInTheDocument();
    expect(requestLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Enviar código/ })).not.toBeInTheDocument();
  });

  it('waits for the saved session before asking for a login', () => {
    auth = { ...auth, isHydrated: false };
    renderView();
    expect(screen.getByLabelText('Carregando')).toBeInTheDocument();
    expect(requestLogin).not.toHaveBeenCalled();
  });

  it('signed in: sends a fresh code to the account e-mail', async () => {
    signedIn();
    renderView([signupsMissing]);
    expect(screen.getByText('maria@exemplo.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enviar código/ }));
    expect(await screen.findByLabelText('Código')).toBeInTheDocument();
    expect(auth.requestLoginCode).toHaveBeenCalledWith('maria@exemplo.com');
    expect(screen.getByRole('button', { name: /Reenviar em 60s/ })).toBeDisabled();
  });

  it('lists the future signups that stop being valid', async () => {
    signedIn();
    const past = { ...FUTURE, id: 'sig-0', event: { ...FUTURE.event, id: 'ev-0', title: 'Evento antigo', start_date: '2020-01-01T10:00:00Z', end_date: '2020-01-01T12:00:00Z' } };
    renderView([signupsMock([FUTURE, past])]);
    expect(await screen.findByText('Estas inscrições deixam de valer')).toBeInTheDocument();
    expect(screen.getByText('Meetup React')).toBeInTheDocument();
    expect(screen.queryByText('Evento antigo')).not.toBeInTheDocument();
  });

  it('leaves the list out while the BFF has no mySignups', async () => {
    signedIn();
    renderView([signupsMissing]);
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(screen.queryByText('Estas inscrições deixam de valer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar código/ })).toBeInTheDocument();
  });

  it('shows the BFF message for a wrong code and keeps the session', async () => {
    signedIn();
    renderView([signupsMissing, deleteWrongCode]);
    await typeCodeAndConfirm('000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorreto. Você tem mais 4 tentativas.');
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(screen.queryByText('Conta excluída')).not.toBeInTheDocument();
  });

  it('shows the BFF message when the code cannot be sent', async () => {
    signedIn();
    auth.requestLoginCode.mockRejectedValue(
      new ApolloError({
        graphQLErrors: [
          new GraphQLError('Aguarde 40 segundos para pedir outro código.', {
            extensions: { code: 'LOGIN_CODE_COOLDOWN', retryAfter: 40 },
          }),
        ],
      })
    );
    renderView([signupsMissing]);
    fireEvent.click(screen.getByRole('button', { name: /Enviar código/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Aguarde 40 segundos');
    // The code sent a moment ago still works: the field is there.
    expect(screen.getByLabelText('Código')).toBeInTheDocument();
  });

  it('asks for the 6 digits before calling the BFF', async () => {
    signedIn();
    renderView([signupsMissing]);
    await typeCodeAndConfirm('12');
    expect(await screen.findByRole('alert')).toHaveTextContent('Digite os 6 números do código.');
  });

  it('deletes with the code, signs out and says the account is gone', async () => {
    signedIn();
    renderView([signupsMissing, deleteOk]);
    await typeCodeAndConfirm('123 456');
    expect(await screen.findByText('Conta excluída')).toBeInTheDocument();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Excluir minha conta/ })).not.toBeInTheDocument());
  });
});
