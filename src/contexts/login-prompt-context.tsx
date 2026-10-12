'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AuthModal } from '@/components/auth-modal';
import { useAuth } from '@/contexts/auth-context';
import { legacyLoginTarget } from '@/lib/login-prompt';

export interface LoginRequest {
  /** Shown under the modal title, e.g. "Entre para gerar sua arte". */
  reason?: string;
  /** Runs once the person is signed in (the action that asked for the login). */
  onSuccess?: () => void;
}

interface LoginPromptValue {
  /** Opens the login modal over the current page; nothing navigates. */
  requestLogin: (request?: LoginRequest) => void;
  isOpen: boolean;
}

// Without the provider (a component rendered alone in a test) asking for a login does nothing.
const LoginPromptContext = createContext<LoginPromptValue>({ requestLogin: () => {}, isOpen: false });

/** The single way to ask for a login (REA-25). Mounted once, under the AuthProvider. */
export function useLoginPrompt(): LoginPromptValue {
  return useContext(LoginPromptContext);
}

/**
 * Runs `action` now when signed in; otherwise opens the login modal and runs it after the
 * login. `action` must not check the session itself: it runs before the page re-renders.
 */
export function useWithLogin() {
  const { isAuthenticated } = useAuth();
  const { requestLogin } = useLoginPrompt();
  return useCallback(
    (action: () => void, reason?: string) => {
      if (isAuthenticated) action();
      else requestLogin({ reason, onSuccess: action });
    },
    [isAuthenticated, requestLogin],
  );
}

/** `?login=true&redirect=/x` from old links: go to /x (or stay) and open the modal there. */
function LegacyLoginLinks({ open }: { open: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuth();
  const search = searchParams.toString();

  useEffect(() => {
    if (!isHydrated) return;
    const target = legacyLoginTarget(pathname || '/', search, window.location.hash);
    if (!target) return;
    router.replace(target.path);
    if (!isAuthenticated) open();
    // Once per URL: replace() drops the login params, which ends it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search, isHydrated]);

  return null;
}

export function LoginPromptProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<LoginRequest | null>(null);
  const requestRef = useRef<LoginRequest | null>(null);

  const { isAuthenticated } = useAuth();
  const signedInRef = useRef(isAuthenticated);
  signedInRef.current = isAuthenticated;

  const requestLogin = useCallback((next: LoginRequest = {}) => {
    // Already signed in (another tab, a stale button): carry on with the action.
    if (signedInRef.current) {
      next.onSuccess?.();
      return;
    }
    requestRef.current = next;
    setRequest(next);
  }, []);

  const openPlain = useCallback(() => requestLogin(), [requestLogin]);

  const handleSignedIn = useCallback(() => {
    const done = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    done?.onSuccess?.();
  }, []);

  const handleClose = useCallback(() => {
    requestRef.current = null;
    setRequest(null);
  }, []);

  const value = useMemo(() => ({ requestLogin, isOpen: request !== null }), [requestLogin, request]);

  return (
    <LoginPromptContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <LegacyLoginLinks open={openPlain} />
      </Suspense>
      <AuthModal
        isOpen={request !== null}
        reason={request?.reason}
        onClose={handleClose}
        onSignedIn={handleSignedIn}
      />
    </LoginPromptContext.Provider>
  );
}
