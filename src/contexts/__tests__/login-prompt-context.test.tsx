import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginRequired } from '@/components/login-required';

import { LoginPromptProvider, useLoginPrompt, useWithLogin } from '../login-prompt-context';

const replace = vi.fn();
const push = vi.fn();
let pathname = '/events/meetup';
let search = '';
let auth = { isAuthenticated: false, isHydrated: true };

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ replace, push }),
}));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => auth }));
// The real modal talks to the BFF; here it only reports a login or a close.
vi.mock('@/components/auth-modal', () => ({
  AuthModal: ({ isOpen, onClose, onSignedIn, reason }: any) =>
    isOpen ? (
      <div role="dialog" aria-label="Entrar na sua conta">
        <p>{reason}</p>
        <button onClick={onSignedIn}>simular login</button>
        <button onClick={onClose}>fechar</button>
      </div>
    ) : null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  pathname = '/events/meetup';
  search = '';
  auth = { isAuthenticated: false, isHydrated: true };
});

function SaveToAgenda({ onSave }: { onSave: (draft: string) => void }) {
  const withLogin = useWithLogin();
  const [draft, setDraft] = useState('');
  return (
    <>
      <input aria-label="nota" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={() => withLogin(() => onSave(draft), 'Entre para salvar')}>Salvar</button>
    </>
  );
}

const signIn = (rerender: () => void) => {
  auth = { isAuthenticated: true, isHydrated: true };
  fireEvent.click(screen.getByRole('button', { name: 'simular login' }));
  rerender();
};

describe('LoginPrompt: an action that asks for a login', () => {
  it('opens the modal over the page and resumes the action after the login, with what was typed', () => {
    const onSave = vi.fn();
    const tree = () => (
      <LoginPromptProvider>
        <SaveToAgenda onSave={onSave} />
      </LoginPromptProvider>
    );
    const { rerender } = render(tree());
    fireEvent.change(screen.getByLabelText('nota'), { target: { value: 'levar notebook' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Entre para salvar');
    expect(onSave).not.toHaveBeenCalled();

    signIn(() => rerender(tree()));
    expect(onSave).toHaveBeenCalledWith('levar notebook');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('nota')).toHaveValue('levar notebook');
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('runs the action right away when already signed in', () => {
    auth = { isAuthenticated: true, isHydrated: true };
    const onSave = vi.fn();
    render(
      <LoginPromptProvider>
        <SaveToAgenda onSave={onSave} />
      </LoginPromptProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does nothing more when the modal is closed without signing in', () => {
    const onSave = vi.fn();
    render(
      <LoginPromptProvider>
        <SaveToAgenda onSave={onSave} />
      </LoginPromptProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    fireEvent.click(screen.getByRole('button', { name: 'fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('LoginPrompt: a whole page that needs a session', () => {
  function Protected() {
    const { isAuthenticated } = auth;
    return isAuthenticated ? <p>dados protegidos</p> : <LoginRequired title="Entre para continuar" />;
  }
  const tree = () => (
    <LoginPromptProvider>
      <Protected />
    </LoginPromptProvider>
  );

  it('shows "entre para continuar" with the modal open, on the same URL, and the page after the login', () => {
    const { rerender } = render(tree());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entre para continuar' })).toBeInTheDocument();
    expect(screen.queryByText('dados protegidos')).not.toBeInTheDocument();

    signIn(() => rerender(tree()));
    expect(screen.getByText('dados protegidos')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps a clear message and a button to reopen after the modal is closed', () => {
    render(tree());
    fireEvent.click(screen.getByRole('button', { name: 'fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entre para continuar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('LoginPrompt: old ?login=true&redirect= links', () => {
  const renderProvider = () => render(<LoginPromptProvider><p>página</p></LoginPromptProvider>);

  it('goes to the redirect and opens the modal there, not on the home page', async () => {
    pathname = '/';
    search = 'login=true&redirect=%2Fadmin%2Fevents%3Ftab%3D1';
    renderProvider();
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith('/admin/events?tab=1');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens the modal on the page itself when there is no redirect', async () => {
    search = 'login=true&tab=2';
    renderProvider();
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith('/events/meetup?tab=2');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('only cleans the URL for someone already signed in', async () => {
    auth = { isAuthenticated: true, isHydrated: true };
    pathname = '/';
    search = 'login=true&redirect=%2Fprofile';
    renderProvider();
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith('/profile');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits for the saved session before deciding', async () => {
    auth = { isAuthenticated: false, isHydrated: false };
    search = 'login=true';
    renderProvider();
    await act(async () => {});
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a page asking for a login outside the provider does not break', () => {
    function Lonely() {
      const { requestLogin } = useLoginPrompt();
      return <button onClick={() => requestLogin()}>pedir</button>;
    }
    render(<Lonely />);
    fireEvent.click(screen.getByRole('button', { name: 'pedir' }));
  });
});
