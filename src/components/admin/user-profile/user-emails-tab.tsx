'use client';

import { useQuery } from '@apollo/client';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { AdminEmpty } from '@/components/admin/admin-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  emailEventLabel, emailKindLabel, emailOutcome, formatDateTimeBR, type EmailOutcomeTone,
} from '@/lib/admin-user';
import { ADMIN_USER_EMAILS } from '@/lib/queries';
import type { AdminUserEmail, AdminUserEmailPage } from '@/lib/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

const TONE: Record<EmailOutcomeTone, string> = {
  good: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  neutral: 'bg-muted text-muted-foreground',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  bad: 'bg-destructive/15 text-destructive',
};

function EmailRow({ email }: { email: AdminUserEmail }) {
  const [open, setOpen] = useState(false);
  const outcome = emailOutcome(email);
  const hasDetails = email.events.length > 0 || !!email.error;
  return (
    <li className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium break-words">{email.subject || emailKindLabel(email.kind)}</div>
          <div className="text-xs text-muted-foreground">
            {emailKindLabel(email.kind)} · {formatDateTimeBR(email.sent_at)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded px-2 py-0.5 text-xs font-medium', TONE[outcome.tone])}>{outcome.label}</span>
          {hasDetails ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              aria-expanded={open}
              aria-label={open ? 'Esconder detalhes' : 'Ver detalhes'}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="mt-3 space-y-2 border-t pt-3 text-sm">
          {email.error ? <p className="text-destructive">Recusado pelo Mailgun: {email.error}</p> : null}
          {email.events.length ? (
            <ol className="space-y-1" aria-label="Linha do tempo">
              {email.events.map((event, index) => (
                <li key={`${event.event}-${event.at}-${index}`} className="flex flex-wrap gap-x-2">
                  <span className="tabular-nums text-muted-foreground">{formatDateTimeBR(event.at)}</span>
                  <span className="font-medium">{emailEventLabel(event)}</span>
                  {event.message ? <span className="text-muted-foreground">— {event.message}</span> : null}
                  {event.url ? <span className="break-all text-muted-foreground">— {event.url}</span> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * REA-52: the "E-mails" tab — every e-mail sent to the user's address, newest first, with what
 * Mailgun reported about it (delivered, opened, clicked, bounced…). Events only exist for e-mails
 * sent after the webhook was configured; before that the badge says whether Mailgun took it.
 */
export function UserEmailsTab({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useQuery<{ adminUserEmails: AdminUserEmailPage }>(ADMIN_USER_EMAILS, {
    variables: { userId, page, pageSize: PAGE_SIZE },
    fetchPolicy: 'network-only',
  });
  const result = data?.adminUserEmails;

  if (loading && !result) {
    return (
      <div role="status" aria-label="Carregando e-mails" className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">Não foi possível carregar os e-mails: {error.message}</p>;
  if (!result || result.items.length === 0) return <AdminEmpty>Nenhum e-mail enviado a este usuário.</AdminEmpty>;

  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {result.total} e-mail{result.total === 1 ? '' : 's'}. &quot;Aberto&quot; depende do leitor carregar as imagens:
        sem ele, o e-mail pode ter sido lido mesmo assim.
      </p>
      <ul className="space-y-2">
        {result.items.map((email) => <EmailRow key={email.id} email={email} />)}
      </ul>
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>{page} de {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
