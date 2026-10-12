'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** Tells whether going to `href` keeps the unsaved work (e.g. another part of the same form). */
type KeepsWork = (href: string) => boolean;

interface UnsavedGuardValue {
  /** A screen with unsaved changes registers here; null when there is nothing to lose. */
  setUnsaved: (keepsWork: KeepsWork | null) => void;
  /** True when the navigation may go on; false when the confirmation was opened instead. */
  request: (href: string) => boolean;
}

const UnsavedGuardContext = createContext<UnsavedGuardValue | null>(null);

const NO_GUARD: UnsavedGuardValue = { setUnsaved: () => {}, request: () => true };

/** The guard of the admin shell; a no-op outside it (a form rendered alone, in a test). */
export function useUnsavedGuard(): UnsavedGuardValue {
  return useContext(UnsavedGuardContext) ?? NO_GUARD;
}

/**
 * Registers unsaved changes while `dirty`: the admin links ask before leaving, and the browser
 * asks on reload or close. `keepsWork` names the links that do not lose anything.
 */
export function useUnsavedChanges(dirty: boolean, keepsWork: KeepsWork) {
  const { setUnsaved } = useUnsavedGuard();
  const keepsWorkRef = useRef(keepsWork);
  keepsWorkRef.current = keepsWork;

  useEffect(() => {
    if (!dirty) return;
    setUnsaved((href) => keepsWorkRef.current(href));
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      setUnsaved(null);
      window.removeEventListener('beforeunload', warn);
    };
  }, [dirty, setUnsaved]);
}

export function UnsavedGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const keepsWorkRef = useRef<KeepsWork | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const setUnsaved = useCallback((keepsWork: KeepsWork | null) => {
    keepsWorkRef.current = keepsWork;
  }, []);

  const request = useCallback((href: string) => {
    const keepsWork = keepsWorkRef.current;
    if (!keepsWork || keepsWork(href)) return true;
    setPendingHref(href);
    return false;
  }, []);

  const value = useMemo(() => ({ setUnsaved, request }), [setUnsaved, request]);

  const leave = () => {
    const href = pendingHref;
    setPendingHref(null);
    if (!href) return;
    keepsWorkRef.current = null;
    router.push(href);
  };

  return (
    <UnsavedGuardContext.Provider value={value}>
      {children}
      <AlertDialog open={pendingHref !== null} onOpenChange={(open) => !open && setPendingHref(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              Há alterações neste evento que ainda não foram salvas. Se você sair agora, elas serão
              perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>Sair sem salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedGuardContext.Provider>
  );
}

/** A next/link that asks before leaving unsaved changes behind. */
export const GuardedLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(
  ({ href, onClick, target, ...props }, ref) => {
    const { request } = useUnsavedGuard();
    return (
      <Link
        ref={ref}
        href={href}
        target={target}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented || target === '_blank') return;
          // A modified click opens another tab: nothing is lost here.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          if (!request(typeof href === 'string' ? href : href.pathname || '')) event.preventDefault();
        }}
        {...props}
      />
    );
  },
);
GuardedLink.displayName = 'GuardedLink';
