'use client';

import { useMutation, useQuery } from '@apollo/client';
import { Loader2, Mail, UserMinus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  COMMUNITY_ORGANIZERS,
  EVENT_MANAGERS,
  INVITE_COMMUNITY_ORGANIZER,
  INVITE_EVENT_MANAGER,
  REMOVE_COMMUNITY_ORGANIZER,
  REMOVE_EVENT_MANAGER,
  REVOKE_MANAGEMENT_INVITE,
} from '@/lib/queries';

/**
 * REA-48 — who organizes a community / manages an event, and the invites still pending. The
 * invite is an e-mail with a link valid for 7 days, for that e-mail only; the person gets the
 * access on their next login by code (REA-26), with or without an account today.
 */

export interface ManagementPerson {
  id: string;
  name: string | null;
  email: string | null;
}

export interface ManagementInviteRow {
  id: string;
  email: string;
  status: string;
  expiresAt: string | null;
  invitedByEmail: string | null;
}

const errorMessage = (err: unknown) => {
  const apollo = err as { graphQLErrors?: { message?: string }[] };
  return apollo?.graphQLErrors?.[0]?.message || 'Não foi possível concluir. Tente novamente.';
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

interface ManagementPeopleProps {
  /** "organizador" | "gestor": used in the texts. */
  noun: string;
  people: ManagementPerson[];
  invites: ManagementInviteRow[];
  canManage: boolean;
  onInvite: (email: string) => Promise<void>;
  onRemove: (person: ManagementPerson) => Promise<void>;
  onRevoke: (invite: ManagementInviteRow) => Promise<void>;
  emptyText: string;
}

/** The list, the pending invites and the invite form (the actions only for who can manage). */
export function ManagementPeople({
  noun,
  people,
  invites,
  canManage,
  onInvite,
  onRemove,
  onRevoke,
  emptyText,
}: ManagementPeopleProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ManagementPerson | null>(null);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast({ title: success });
      return true;
    } catch (err) {
      toast({ variant: 'destructive', title: errorMessage(err) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    if (await run(() => onInvite(value), `Convite enviado para ${value}.`)) setEmail('');
  };

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-lg border" aria-label={`${noun}es`}>
        {people.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">{emptyText}</li>
        )}
        {people.map(person => (
          <li key={person.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{person.name || person.email}</div>
              {person.name && (
                <div className="truncate text-xs text-muted-foreground">{person.email}</div>
              )}
            </div>
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={busy}
                aria-label={`Remover ${person.name || person.email}`}
                onClick={() => setRemoving(person)}
              >
                <UserMinus className="mr-1 h-4 w-4" />
                Remover
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canManage && invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Convites pendentes</p>
          <ul className="divide-y rounded-lg border" aria-label="Convites pendentes">
            {invites.map(invite => (
              <li key={invite.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 text-sm">
                  <div className="truncate">{invite.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Vale até {formatDate(invite.expiresAt)}
                    {invite.invitedByEmail ? ` · por ${invite.invitedByEmail}` : ''}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={`Cancelar o convite de ${invite.email}`}
                  onClick={() => run(() => onRevoke(invite), 'Convite cancelado.')}
                >
                  <X className="mr-1 h-4 w-4" />
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && (
        <form onSubmit={submit} className="space-y-1.5">
          <Label htmlFor={`invite-${noun}`}>Convidar {noun} por e-mail</Label>
          <div className="flex gap-2">
            <Input
              id={`invite-${noun}`}
              type="email"
              placeholder="pessoa@exemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
            />
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Convidar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A pessoa recebe um link que vale por 7 dias, só para esse e-mail. Quem ainda não tem conta
            cria no primeiro acesso.
          </p>
        </form>
      )}

      <AlertDialog open={!!removing} onOpenChange={open => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {noun}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name || removing?.email} perde o acesso. O papel da conta não muda: se
              precisar, ajuste em Usuários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const person = removing;
                setRemoving(null);
                if (person) run(() => onRemove(person), 'Acesso removido.');
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** REA-48: the organizers of a community (admin only), in a dialog of /admin/communities. */
export function CommunityOrganizersDialog({
  community,
  onOpenChange,
}: {
  community: { id: string; title?: string | null } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const communityId = community?.id ?? '';
  const { data, loading, refetch } = useQuery<{
    communityOrganizers: { organizers: ManagementPerson[]; invites: ManagementInviteRow[] };
  }>(COMMUNITY_ORGANIZERS, { variables: { communityId }, skip: !community, fetchPolicy: 'network-only' });
  const [invite] = useMutation(INVITE_COMMUNITY_ORGANIZER);
  const [remove] = useMutation(REMOVE_COMMUNITY_ORGANIZER);
  const [revoke] = useMutation(REVOKE_MANAGEMENT_INVITE);

  return (
    <Dialog open={!!community} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Organizadores de {community?.title || 'comunidade'}</DialogTitle>
          <DialogDescription>
            Quem organiza a comunidade edita os eventos dela no admin. Ao aceitar o convite, a pessoa
            recebe o papel Community Manager.
          </DialogDescription>
        </DialogHeader>
        {loading && !data ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <ManagementPeople
            noun="organizador"
            people={data?.communityOrganizers.organizers ?? []}
            invites={data?.communityOrganizers.invites ?? []}
            canManage
            emptyText="Ninguém organiza esta comunidade ainda."
            onInvite={async email => {
              await invite({ variables: { communityId, email } });
              await refetch();
            }}
            onRemove={async person => {
              await remove({ variables: { communityId, userId: person.id } });
              await refetch();
            }}
            onRevoke={async row => {
              await revoke({ variables: { id: row.id } });
              await refetch();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** REA-48: the managers of an event, in its configuration (Geral). */
export function EventManagersCard({ eventId }: { eventId: string }) {
  const { data, loading, refetch } = useQuery<{
    eventManagers: { canManage: boolean; managers: ManagementPerson[]; invites: ManagementInviteRow[] };
  }>(EVENT_MANAGERS, { variables: { eventId }, skip: !eventId, fetchPolicy: 'network-only' });
  const [invite] = useMutation(INVITE_EVENT_MANAGER);
  const [remove] = useMutation(REMOVE_EVENT_MANAGER);
  const [revoke] = useMutation(REVOKE_MANAGEMENT_INVITE);
  const managers = data?.eventManagers;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Gestores</CardTitle>
        <CardDescription>
          Quem gere só este evento no admin: edita o evento e cuida de inscrições, presenças,
          certificados, arte e e-mails dele, sem criar eventos nem mexer na comunidade. Ao aceitar
          o convite, a pessoa recebe o papel Event Manager (quem já é Community Manager ou Admin
          continua com o papel que tem).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && !managers ? (
          <div className="py-4 text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <ManagementPeople
            noun="gestor"
            people={managers?.managers ?? []}
            invites={managers?.invites ?? []}
            canManage={Boolean(managers?.canManage)}
            emptyText="Este evento não tem gestores."
            onInvite={async email => {
              await invite({ variables: { eventId, email } });
              await refetch();
            }}
            onRemove={async person => {
              await remove({ variables: { eventId, userId: person.id } });
              await refetch();
            }}
            onRevoke={async row => {
              await revoke({ variables: { id: row.id } });
              await refetch();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
