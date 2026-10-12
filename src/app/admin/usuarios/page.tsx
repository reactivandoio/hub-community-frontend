'use client';

import { useMutation, useQuery } from '@apollo/client';
import { ChevronLeft, ChevronRight, History, Search, Users } from 'lucide-react';
import { useState } from 'react';

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
import { Input } from '@/components/ui/input';
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
import { useAuth } from '@/contexts/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { roleLabel } from '@/lib/admin-access';
import { ADMIN_ROLES, ADMIN_USERS, ROLE_CHANGES, SET_USER_ROLE } from '@/lib/queries';

// Admin only (ADMIN_ONLY_PATHS in lib/admin-access); the BFF checks it again on every call,
// and refuses taking your own admin role away and leaving the Hub without an admin.

const PAGE_SIZE = 20;
const ALL_ROLES = 'all';

interface AdminUserRow {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  blocked: boolean;
  role: { type: string; name: string } | null;
  communities: { id: string; title: string | null }[];
}

interface RoleChangeRow {
  id: string;
  actorEmail: string | null;
  targetId: string | null;
  targetEmail: string | null;
  fromRole: string | null;
  toRole: string;
  createdAt: string | null;
}

interface PendingChange {
  user: AdminUserRow;
  roleType: string;
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const roleVariant = (type: string | undefined) =>
  type === 'admin' ? 'default' : type === 'community-manager' ? 'secondary' : 'outline';

function Pager({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
      <span>
        Página {page} de {pages} · {total} no total
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Próxima página"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function RoleHistory({ userId, title }: { userId?: string; title: string }) {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useQuery<{
    roleChanges: { items: RoleChangeRow[]; total: number; page: number; pageSize: number };
  }>(ROLE_CHANGES, {
    variables: { userId, page, pageSize: PAGE_SIZE },
    fetchPolicy: 'cache-and-network',
  });
  const changes = data?.roleChanges;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <History className="h-5 w-5" /> {title}
      </h2>
      {error && <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>}
      {!error && loading && !changes && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {changes && changes.items.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma troca de role registrada.</p>
      )}
      {changes && changes.items.length > 0 && (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>De → Para</TableHead>
                  <TableHead>Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.items.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(change.createdAt)}</TableCell>
                    <TableCell>{change.targetEmail || change.targetId || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {roleLabel(change.fromRole)} → {roleLabel(change.toRole)}
                    </TableCell>
                    <TableCell>{change.actorEmail || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={changes.page} total={changes.total} pageSize={changes.pageSize} onPage={setPage} />
        </>
      )}
    </section>
  );
}

export default function UsersAdminPage() {
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES);
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [historyUser, setHistoryUser] = useState<AdminUserRow | null>(null);
  const debouncedSearch = useDebounce(search.trim(), 300);

  const { data: rolesData } = useQuery<{ adminRoles: { type: string; name: string }[] }>(ADMIN_ROLES);
  const roles = rolesData?.adminRoles || [];

  const { data, loading, error, refetch } = useQuery<{
    adminUsers: { items: AdminUserRow[]; total: number; page: number; pageSize: number };
  }>(ADMIN_USERS, {
    variables: {
      search: debouncedSearch || null,
      role: roleFilter === ALL_ROLES ? null : roleFilter,
      page,
      pageSize: PAGE_SIZE,
    },
    fetchPolicy: 'cache-and-network',
  });
  const users = data?.adminUsers;

  const [setUserRole, { loading: saving }] = useMutation(SET_USER_ROLE, {
    refetchQueries: [ROLE_CHANGES],
  });

  const isMe = (row: AdminUserRow) =>
    !!me?.email && !!row.email && me.email.toLowerCase() === row.email.toLowerCase();

  const confirmChange = async () => {
    if (!pending) return;
    const { user, roleType } = pending;
    try {
      await setUserRole({ variables: { userId: user.id, roleType } });
      toast({
        title: 'Role alterada',
        description: `${user.email || user.username} agora é ${roleLabel(roleType)}. Vale em até 1 minuto.`,
      });
      await refetch();
    } catch (err) {
      toast({
        title: 'Não foi possível alterar a role',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto px-4 pt-10 pb-12 space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" /> Usuários e Roles
          </h1>
          <p className="text-muted-foreground mt-2">
            Admin vê e faz tudo e define as roles. Community Manager gerencia só as comunidades em que
            está como organizador e os eventos delas. Os demais são usuários comuns.
          </p>
        </div>

        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Buscar usuários"
                placeholder="Buscar por nome, e-mail ou usuário"
                className="pl-9"
                value={search}
                maxLength={100}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="sm:w-56" aria-label="Filtrar por role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROLES}>Todas as roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.type} value={role.type}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive">Não foi possível carregar os usuários: {error.message}</p>
          )}
          {!error && loading && !users && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {users && (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Organiza</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhum usuário encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                    {users.items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.name || row.username || '—'}</div>
                          <div className="text-sm text-muted-foreground">{row.email}</div>
                          {row.blocked && <Badge variant="destructive">Bloqueado</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.communities.length
                            ? row.communities.map((c) => c.title).filter(Boolean).join(', ')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.role?.type || ''}
                            disabled={saving || roles.length === 0}
                            onValueChange={(roleType) => {
                              if (roleType !== row.role?.type) setPending({ user: row, roleType });
                            }}
                          >
                            <SelectTrigger
                              className="w-48"
                              aria-label={`Role de ${row.email || row.username}`}
                            >
                              <SelectValue placeholder={roleLabel(row.role?.type)}>
                                <Badge variant={roleVariant(row.role?.type)}>{roleLabel(row.role?.type)}</Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem
                                  key={role.type}
                                  value={role.type}
                                  // Your own admin role stays (the BFF refuses it too).
                                  disabled={isMe(row) && row.role?.type === 'admin' && role.type !== 'admin'}
                                >
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isMe(row) && <span className="ml-2 text-xs text-muted-foreground">você</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setHistoryUser(row)}>
                            <History className="h-4 w-4 mr-1" /> Histórico
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pager page={users.page} total={users.total} pageSize={users.pageSize} onPage={setPage} />
            </>
          )}
        </section>

        {historyUser ? (
          <div className="space-y-2">
            <Button variant="link" className="px-0" onClick={() => setHistoryUser(null)}>
              Ver o histórico de todos
            </Button>
            <RoleHistory
              key={historyUser.id}
              userId={historyUser.id}
              title={`Histórico de ${historyUser.email || historyUser.username}`}
            />
          </div>
        ) : (
          <RoleHistory title="Histórico de trocas de role" />
        )}

        <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Alterar role?</AlertDialogTitle>
              <AlertDialogDescription>
                {pending &&
                  `${pending.user.email || pending.user.username}: ${roleLabel(pending.user.role?.type)} → ${roleLabel(
                    pending.roleType,
                  )}. A troca fica registrada no histórico.`}
                {pending?.roleType === 'community-manager' &&
                  pending.user.communities.length === 0 &&
                  ' Atenção: este usuário não organiza nenhuma comunidade, então não verá nada no admin até ser incluído como organizador.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={saving} onClick={confirmChange}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </FadeIn>
  );
}
