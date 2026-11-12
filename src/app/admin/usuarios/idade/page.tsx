'use client';

import { useMutation, useQuery } from '@apollo/client';
import { ChevronLeft, ChevronRight, Mail, UserX } from 'lucide-react';
import { useState } from 'react';

import { AdminPage, AdminPageHeader } from '@/components/admin/admin-page';
import { FadeIn } from '@/components/animations';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  MAX_SELECTION,
  ageReviewStatusLabel,
  canBlockMinor,
  canRequestDateOfBirth,
  formatDateTime,
  formatIsoDate,
} from '@/lib/age-review';
import {
  ADMIN_AGE_REVIEW,
  ADMIN_AGE_REVIEW_SUMMARY,
  ADMIN_BLOCK_MINOR,
  ADMIN_REQUEST_DATE_OF_BIRTH,
} from '@/lib/queries';
import type {
  AgeReviewBlockResult,
  AgeReviewKind,
  AgeReviewPage,
  AgeReviewRequestBatch,
  AgeReviewSummary,
  AgeReviewUser,
} from '@/lib/types';

// REA-36: admin only (under /admin/usuarios, ADMIN_ONLY_PATHS); the BFF checks it again.
// Nothing here runs by itself: every e-mail and every deactivation is a click of the admin.

const PAGE_SIZE = 50;
const ALL = 'all';

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
      <span>Página {page} de {pages} · {total} no total</span>
      <Button variant="outline" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Próxima página" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StatusBadge({ user }: { user: AgeReviewUser }) {
  const label = ageReviewStatusLabel(user);
  const variant = user.blocked ? 'destructive' : user.status === 'dob_requested' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{label}</Badge>;
}

function Person({ user }: { user: AgeReviewUser }) {
  return (
    <>
      <div className="font-medium">{user.name || user.username || '—'}</div>
      <div className="text-sm text-muted-foreground">{user.email}</div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
}

function useAgeReview(kind: AgeReviewKind, status: string, page: number) {
  return useQuery<{ adminAgeReview: AgeReviewPage }>(ADMIN_AGE_REVIEW, {
    variables: { kind, status: status === ALL ? null : status, page, pageSize: PAGE_SIZE },
    fetchPolicy: 'cache-and-network',
  });
}

function NoBirthDateTab({ emailsLeft, onChanged }: { emailsLeft: number | null; onChanged: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState('NONE');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const { data, loading, error, refetch } = useAgeReview('NO_BIRTH_DATE', status, page);
  const list = data?.adminAgeReview;
  const selectable = (list?.items || []).filter(canRequestDateOfBirth);

  const [request, { loading: sending }] = useMutation<{ adminRequestDateOfBirth: AgeReviewRequestBatch }>(
    ADMIN_REQUEST_DATE_OF_BIRTH,
  );

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on && next.size < MAX_SELECTION) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const allOnPage = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const toggleAll = (on: boolean) =>
    setSelected(on ? new Set(selectable.slice(0, MAX_SELECTION).map((u) => u.id)) : new Set());

  const left = list?.emailsLeftToday ?? emailsLeft;
  const willSend = left === null ? selected.size : Math.min(selected.size, left);

  const send = async () => {
    try {
      const { data: res } = await request({ variables: { userIds: [...selected] } });
      const r = res?.adminRequestDateOfBirth;
      if (r) {
        const quota = r.results.filter((x) => x.outcome === 'quota').length;
        toast({
          title: `${r.sent} e-mail(s) enviado(s)`,
          description: [
            r.failed ? `${r.failed} falharam.` : '',
            quota ? `${quota} ficaram para outro dia (cota de hoje esgotada).` : '',
            r.skipped - quota > 0 ? `${r.skipped - quota} não precisavam do pedido.` : '',
            `Restam ${r.emailsLeftToday} envios hoje.`,
          ].filter(Boolean).join(' '),
          variant: r.failed && !r.sent ? 'destructive' : undefined,
        });
      }
      setSelected(new Set());
      await refetch();
      onChanged();
    } catch (err) {
      toast({ title: 'Não foi possível enviar', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Contas sem data de nascimento. O pedido manda um e-mail para a pessoa informar a data em até 7 dias.
        Se ela não informar, a conta é desativada automaticamente; se informar, o pedido se encerra. Os 7 dias
        contam a partir do envio de cada e-mail.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); setSelected(new Set()); }}>
          <SelectTrigger className="sm:w-64" aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Sem ação</SelectItem>
            <SelectItem value="dob_requested">Aguardando a data</SelectItem>
            <SelectItem value="dob_blocked">Desativadas</SelectItem>
            <SelectItem value={ALL}>Todas</SelectItem>
          </SelectContent>
        </Select>
        <Button disabled={selected.size === 0 || sending || left === 0} onClick={() => setConfirming(true)}>
          <Mail className="h-4 w-4 mr-2" />
          Pedir data de nascimento ({selected.size})
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">Não foi possível carregar: {error.message}</p>}
      {!error && loading && !list && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {list && (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Selecionar todos desta página"
                      checked={allOnPage}
                      disabled={selectable.length === 0}
                      onCheckedChange={(v) => toggleAll(v === true)}
                    />
                  </TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Declarou 18+</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma conta nesta lista.</TableCell>
                  </TableRow>
                )}
                {list.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Selecionar ${user.email || user.username}`}
                        checked={selected.has(user.id)}
                        disabled={!canRequestDateOfBirth(user)}
                        onCheckedChange={(v) => toggle(user.id, v === true)}
                      />
                    </TableCell>
                    <TableCell><Person user={user} /></TableCell>
                    <TableCell className="text-sm">{formatDateTime(user.createdAt)}</TableCell>
                    <TableCell className="text-sm">{user.adultDeclaredAt ? formatDateTime(user.adultDeclaredAt) : 'Não'}</TableCell>
                    <TableCell><StatusBadge user={user} /></TableCell>
                    <TableCell className="text-sm">{formatDateTime(user.deadline)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={list.page} total={list.total} pageSize={list.pageSize} onPage={(p) => { setPage(p); setSelected(new Set()); }} />
        </>
      )}

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pedir a data de nascimento?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Vamos enviar ${willSend} e-mail(s) pedindo a data de nascimento.`}
              {left !== null && selected.size > left
                ? ` Hoje restam só ${left} envios (cota compartilhada com as campanhas); os outros ${selected.size - left} ficam para outro dia.`
                : ''}
              {' Quem não informar a data em 7 dias terá a conta desativada automaticamente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={sending} onClick={send}>Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function MinorsTab({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AgeReviewUser | null>(null);
  const { data, loading, error, refetch } = useAgeReview('MINOR', status, page);
  const list = data?.adminAgeReview;

  const [blockMinor, { loading: blocking }] = useMutation<{ adminBlockMinor: AgeReviewBlockResult }>(ADMIN_BLOCK_MINOR);

  const confirm = async () => {
    if (!target) return;
    try {
      const { data: res } = await blockMinor({ variables: { userId: target.id } });
      const r = res?.adminBlockMinor;
      if (r) {
        toast({
          title: target.blocked ? 'E-mail reenviado' : 'Conta desativada',
          description: `${r.message} Restam ${r.emailsLeftToday} envios hoje.`,
          variant: r.emailSent ? undefined : 'destructive',
        });
      }
      await refetch();
      onChanged();
    } catch (err) {
      toast({ title: 'Não foi possível desativar', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setTarget(null);
    }
  };

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Contas cuja data de nascimento é de menor de 18 anos. Desativar impede o login e novas inscrições
        e envia um e-mail explicando o motivo. As inscrições já feitas não são alteradas.
      </p>
      <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <SelectTrigger className="sm:w-64" aria-label="Filtrar por situação">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas</SelectItem>
          <SelectItem value="NONE">Sem ação</SelectItem>
          <SelectItem value="minor_blocked">Desativadas</SelectItem>
        </SelectContent>
      </Select>

      {error && <p className="text-sm text-destructive">Não foi possível carregar: {error.message}</p>}
      {!error && loading && !list && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {list && (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma conta nesta lista.</TableCell>
                  </TableRow>
                )}
                {list.items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell><Person user={user} /></TableCell>
                    <TableCell className="text-sm">
                      {formatIsoDate(user.dateOfBirth)}{user.age !== null ? ` (${user.age} anos)` : ''}
                    </TableCell>
                    <TableCell><StatusBadge user={user} /></TableCell>
                    <TableCell className="text-right">
                      {canBlockMinor(user) && (
                        <Button
                          variant={user.blocked ? 'ghost' : 'destructive'}
                          size="sm"
                          disabled={blocking}
                          onClick={() => setTarget(user)}
                        >
                          {user.blocked ? <Mail className="h-4 w-4 mr-1" /> : <UserX className="h-4 w-4 mr-1" />}
                          {user.blocked ? 'Reenviar e-mail' : 'Desativar e avisar'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={list.page} total={list.total} pageSize={list.pageSize} onPage={setPage} />
        </>
      )}

      <AlertDialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target?.blocked ? 'Reenviar o e-mail?' : 'Desativar a conta?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {target &&
                (target.blocked
                  ? `${target.email} recebe de novo o e-mail explicando por que a conta foi desativada.`
                  : `${target.email} (nascimento ${formatIsoDate(target.dateOfBirth)}) não poderá mais entrar nem se inscrever, e receberá um e-mail explicando o motivo. As inscrições já feitas continuam como estão.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={blocking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={blocking} onClick={confirm}>
              {target?.blocked ? 'Reenviar' : 'Desativar e avisar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default function AgeReviewPage() {
  const [tab, setTab] = useState('sem-data');
  const { data, refetch } = useQuery<{ adminAgeReviewSummary: AgeReviewSummary }>(ADMIN_AGE_REVIEW_SUMMARY, {
    fetchPolicy: 'cache-and-network',
  });
  const summary = data?.adminAgeReviewSummary;
  const refresh = () => { refetch().catch(() => {}); };

  return (
    <FadeIn direction="up" duration={0.3}>
      <AdminPage>
        <AdminPageHeader
          title="Idade (18+)"
          description="O Hub Community é só para pessoas com 18 anos ou mais. Aqui ficam as contas sem data de nascimento e as de menores de idade."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat
            label="Sem data de nascimento"
            value={summary?.noBirthDate ?? '—'}
            hint={summary ? `${summary.notRequested} sem ação · ${summary.requested} aguardando` : undefined}
          />
          <Stat
            label="Menores de idade"
            value={summary?.minors ?? '—'}
            hint={summary ? `${summary.minorsBlocked} desativadas` : undefined}
          />
          <Stat
            label="E-mails restantes hoje"
            value={summary?.emailsLeftToday ?? '—'}
            hint="Cota diária compartilhada com as campanhas de e-mail."
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="sem-data">Sem data de nascimento</TabsTrigger>
            <TabsTrigger value="menores">Menores de idade</TabsTrigger>
          </TabsList>
          <TabsContent value="sem-data" forceMount className="data-[state=inactive]:hidden">
            <NoBirthDateTab emailsLeft={summary?.emailsLeftToday ?? null} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="menores" forceMount className="data-[state=inactive]:hidden">
            <MinorsTab onChanged={refresh} />
          </TabsContent>
        </Tabs>
      </AdminPage>
    </FadeIn>
  );
}
