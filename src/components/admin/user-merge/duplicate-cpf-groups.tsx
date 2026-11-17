'use client';

import { useQuery } from '@apollo/client';
import { Merge } from 'lucide-react';
import { useState } from 'react';

import { GuardedLink } from '@/components/admin/unsaved-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { roleLabel } from '@/lib/admin-access';
import { adminUserHref, formatDateBR, formatDateTimeBR } from '@/lib/admin-user';
import { ADMIN_DUPLICATE_CPF_GROUPS } from '@/lib/queries';
import type { AdminDuplicateCpfGroup } from '@/lib/types';

import { UserMergeDialog } from './user-merge-dialog';

/**
 * REA-96: "CPFs duplicados" of /admin/usuarios — every group of accounts sharing a CPF (the CPF is
 * never shown), with what each account has and the account suggested to stay. "Juntar" opens the
 * same confirmation as the user's page; nothing is joined without the admin's click.
 */
export function DuplicateCpfGroups() {
  const [merging, setMerging] = useState<AdminDuplicateCpfGroup | null>(null);
  const { data, loading, error } = useQuery<{
    adminDuplicateCpfGroups: { total: number; groups: AdminDuplicateCpfGroup[] };
  }>(ADMIN_DUPLICATE_CPF_GROUPS, { fetchPolicy: 'cache-and-network' });
  const result = data?.adminDuplicateCpfGroups;

  if (error) return <p className="text-sm text-destructive">Não foi possível carregar os CPFs duplicados: {error.message}</p>;
  if (loading && !result) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!result || result.groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum CPF duplicado. Cada CPF está em uma conta só.</p>;
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {result.total} {result.total === 1 ? 'CPF está' : 'CPFs estão'} em mais de uma conta. A sugestão é a conta com mais
        vínculos (inscrições, certificados, presenças…) ou, no empate, a que entrou por último; você confirma em
        &quot;Juntar&quot;.
      </p>
      {result.groups.map((group, index) => (
        <div key={group.id} className="space-y-2 rounded-lg border p-3" data-testid={`duplicate-group-${group.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Grupo {index + 1}</h3>
              <p className="text-xs text-muted-foreground">{group.suggestionReason}</p>
            </div>
            <Button size="sm" onClick={() => setMerging(group)}>
              <Merge className="mr-2 h-4 w-4" />
              Juntar
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Inscrições</TableHead>
                  <TableHead className="text-right">Certificados</TableHead>
                  <TableHead className="text-right">Vínculos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <GuardedLink href={adminUserHref(user.id)} className="font-medium text-primary hover:underline">
                        {user.name || 'Sem nome'}
                      </GuardedLink>
                      <div className="break-all text-sm text-muted-foreground">{user.email} · #{user.id}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {group.suggestedKeepId === user.id ? <Badge>Sugerida para ficar</Badge> : null}
                        {user.isAdmin || user.isManager ? <Badge variant="secondary">{roleLabel(user.role)}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateBR(user.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">{user.last_login_at ? formatDateTimeBR(user.last_login_at) : 'Nunca'}</TableCell>
                    <TableCell>
                      {user.blocked ? <Badge variant="destructive">Desativada</Badge> : <Badge variant="outline">Ativa</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{user.signups}</TableCell>
                    <TableCell className="text-right">{user.certificates}</TableCell>
                    <TableCell className="text-right" title={user.linkDetails.map((link) => `${link.label}: ${link.count}`).join('\n')}>
                      {user.links}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      <UserMergeDialog
        accounts={(merging?.users || []).map((user) => ({ id: user.id, name: user.name, email: user.email }))}
        defaultKeepId={merging?.suggestedKeepId ?? null}
        open={!!merging}
        onOpenChange={(open) => {
          if (!open) setMerging(null);
        }}
      />
    </section>
  );
}
