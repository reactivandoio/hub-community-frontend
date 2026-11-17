'use client';

import { useQuery } from '@apollo/client';
import { Merge, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { adminUserHref } from '@/lib/admin-user';
import { ADMIN_DUPLICATE_CPF_GROUPS, ADMIN_USERS } from '@/lib/queries';
import type { AdminDuplicateCpfGroup, AdminUserProfile } from '@/lib/types';

import { type MergeAccountOption, UserMergeDialog } from './user-merge-dialog';

const MIN_SEARCH = 3;

interface UserRow {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  blocked?: boolean;
}

function AccountButton({ account, note, onPick }: { account: UserRow; note?: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted"
    >
      <span className="font-medium">{account.name || account.username || 'Sem nome'}</span>
      <span className="block break-all text-muted-foreground">
        {account.email || 'sem e-mail'} · #{account.id}
        {account.blocked ? ' · desativada' : ''}
      </span>
      {note ? <span className="block text-xs text-primary">{note}</span> : null}
    </button>
  );
}

/**
 * REA-96: "Juntar com outra conta" on /admin/usuarios/<id>. The admin picks the other account (the
 * ones with the same CPF first, or any account by search), then confirms in UserMergeDialog, where
 * the account that stays is chosen.
 */
export function UserMergeButton({ profile }: { profile: AdminUserProfile }) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [other, setOther] = useState<UserRow | null>(null);
  const [search, setSearch] = useState('');
  const term = useDebounce(search.trim(), 300);

  const { data: groupsData } = useQuery<{ adminDuplicateCpfGroups: { groups: AdminDuplicateCpfGroup[] } }>(
    ADMIN_DUPLICATE_CPF_GROUPS,
    { skip: !picking && !other, fetchPolicy: 'cache-and-network' },
  );
  const group = (groupsData?.adminDuplicateCpfGroups?.groups || [])
    .find((candidate) => candidate.users.some((user) => user.id === profile.id));
  const sameCpf = (group?.users || []).filter((user) => user.id !== profile.id);

  const { data: usersData, loading: searching } = useQuery<{ adminUsers: { items: UserRow[] } }>(ADMIN_USERS, {
    variables: { search: term, role: null, page: 1, pageSize: 10 },
    skip: !picking || term.length < MIN_SEARCH,
  });
  const found = (usersData?.adminUsers?.items || []).filter((user) => user.id !== profile.id);

  const pick = (account: UserRow) => {
    setOther(account);
    setPicking(false);
    setSearch('');
  };

  const accounts: MergeAccountOption[] = other
    ? [{ id: profile.id, name: profile.name, email: profile.email }, { id: other.id, name: other.name, email: other.email }]
    : [];
  // The duplicate CPF list's suggestion, when the other account is in the same group.
  const suggested = other && group?.users.some((user) => user.id === other.id) ? group.suggestedKeepId : null;

  return (
    <>
      <Button variant="outline" onClick={() => setPicking(true)}>
        <Merge className="mr-2 h-4 w-4" />
        Juntar com outra conta
      </Button>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Juntar com outra conta</DialogTitle>
            <DialogDescription>
              Escolha a outra conta da mesma pessoa. No passo seguinte você escolhe qual fica e vê o que muda.
            </DialogDescription>
          </DialogHeader>

          {sameCpf.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Com o mesmo CPF</p>
              {sameCpf.map((user) => (
                <AccountButton
                  key={user.id}
                  account={user}
                  note={group?.suggestedKeepId === user.id ? 'Sugerida para ficar' : undefined}
                  onPick={() => pick(user)}
                />
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-medium">Buscar outra conta</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar a outra conta"
                placeholder="Nome, e-mail ou usuário"
                className="pl-9"
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {term.length >= MIN_SEARCH && searching ? <p className="text-sm text-muted-foreground">Buscando…</p> : null}
            {term.length >= MIN_SEARCH && !searching && found.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma outra conta encontrada.</p>
            ) : null}
            {found.map((user) => <AccountButton key={user.id} account={user} onPick={() => pick(user)} />)}
          </div>
        </DialogContent>
      </Dialog>

      <UserMergeDialog
        accounts={accounts}
        defaultKeepId={suggested}
        open={!!other}
        onOpenChange={(open) => {
          if (!open) setOther(null);
        }}
        onMerged={(result) => {
          // The page of the dropped account is gone: go to the one that stayed.
          if (result.keepUserId !== profile.id) router.push(adminUserHref(result.keepUserId));
        }}
      />
    </>
  );
}
