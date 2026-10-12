'use client';

import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { AdminPageActions } from '@/components/admin/page-actions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * The standard frame of an admin page's content (REA-24): the whole width beside the sidebar,
 * the same side padding and vertical rhythm everywhere. The shell adds the rest of the side
 * padding on wider screens. No back arrow and no max-width here: the breadcrumb and the sidebar
 * are the way back, and a block that must stay narrow caps itself.
 */
export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('w-full space-y-6 px-4 py-8', className)}>{children}</div>;
}

/**
 * The one page header of the admin: title, an optional line under it, and the page's actions,
 * which go up to the top bar (see AdminPageActions). What the breadcrumb already says (the
 * event's name, "voltar") does not belong here.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons of the page; shown in the top bar. */
  actions?: ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {actions ? <AdminPageActions>{actions}</AdminPageActions> : null}
    </div>
  );
}

/** The page is loading and has nothing to show yet: a skeleton of header and content. */
export function AdminPageLoading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="w-full space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** The page could not load (or what it shows does not exist). */
export function AdminPageError({
  title = 'Não foi possível carregar',
  message,
  action,
}: {
  title?: string;
  message?: ReactNode;
  /** e.g. { label: 'Voltar para a lista', onClick } */
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 px-4 py-8 text-center"
    >
      <AlertCircle aria-hidden="true" className="h-8 w-8 text-destructive" />
      <h2 className="text-lg font-semibold">{title}</h2>
      {message ? <p className="max-w-md text-sm text-muted-foreground">{message}</p> : null}
      {action ? (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/** A list or block with nothing in it yet. */
export function AdminEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
