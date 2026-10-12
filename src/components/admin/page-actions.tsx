'use client';

import { MoreVertical } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageActionsValue {
  /** The element of the top bar where the actions are shown. */
  target: HTMLElement | null;
  setTarget: (element: HTMLElement | null) => void;
  /** How many pages (or blocks) have actions up there now. */
  count: number;
  register: () => () => void;
}

const PageActionsContext = createContext<PageActionsValue | null>(null);

/** Holds the top bar slot of the admin shell; AdminPageActions fills it from any page. */
export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((value) => value + 1);
    return () => setCount((value) => value - 1);
  }, []);
  const value = useMemo(() => ({ target, setTarget, count, register }), [target, count, register]);
  return <PageActionsContext.Provider value={value}>{children}</PageActionsContext.Provider>;
}

/**
 * The actions of an admin page ("Novo Evento", "Salvar Evento", "Atualizar"…): the page declares
 * them here and the top bar of the admin shows them, at the right of the breadcrumb (REA-24).
 * They stay part of the page's React tree (state, context and handlers work as written), only
 * the DOM moves; a submit button therefore needs `form="<id of its form>"`.
 * Outside the admin shell (a component rendered alone, in a test) they render in place.
 */
export function AdminPageActions({ children }: { children: ReactNode }) {
  const context = useContext(PageActionsContext);
  const register = context?.register;

  useEffect(() => register?.(), [register]);

  if (!context) return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
  if (!context.target) return null;
  return createPortal(children, context.target);
}

/**
 * Where the top bar shows the page actions. From `md` up they sit in the bar; on the phone they
 * go into a menu opened by the "Ações da página" button, which only exists when there are actions.
 */
export function PageActionsSlot({ pathname }: { pathname: string }) {
  const context = useContext(PageActionsContext);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // A choice was made: the phone menu closes. A native listener, because React events of the
  // portaled actions bubble to the page that declared them, not to this element.
  const target = context?.target;
  useEffect(() => {
    if (!target) return;
    const close = () => setOpen(false);
    target.addEventListener('click', close);
    return () => target.removeEventListener('click', close);
  }, [target]);

  if (!context) return null;
  const hasActions = context.count > 0;

  return (
    <>
      {hasActions && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 md:hidden"
          aria-label="Ações da página"
          aria-expanded={open}
          aria-controls="admin-page-actions"
          onClick={() => setOpen((value) => !value)}
        >
          <MoreVertical aria-hidden="true" className="h-4 w-4" />
        </Button>
      )}
      <div
        id="admin-page-actions"
        ref={context.setTarget}
        data-testid="admin-page-actions"
        className={cn(
          // Phone: a menu under the top bar, with one action per line.
          'absolute right-3 top-full z-30 mt-1 min-w-52 flex-col items-stretch gap-2 rounded-md border bg-popover p-2 shadow-md [&_a]:w-full [&_button]:w-full',
          open && hasActions ? 'flex' : 'hidden',
          // From md up: in the bar itself.
          'md:static md:z-auto md:mt-0 md:min-w-0 md:shrink-0 md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0 md:shadow-none md:[&_a]:w-auto md:[&_button]:w-auto',
          hasActions ? 'md:flex' : 'md:hidden',
        )}
      />
    </>
  );
}
