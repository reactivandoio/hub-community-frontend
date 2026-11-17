'use client';

import { useMutation, useQuery } from '@apollo/client';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { mergeMoveLines, mergeNotes } from '@/lib/admin-user-merge';
import { ADMIN_MERGE_PREVIEW, ADMIN_MERGE_USERS } from '@/lib/queries';
import type { AdminMergePreview, AdminMergeResult } from '@/lib/types';

export interface MergeAccountOption {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface UserMergeDialogProps {
  /** The accounts to choose from (two, or a whole duplicate CPF group). */
  accounts: MergeAccountOption[];
  /** The account suggested to stay; none = the admin picks. */
  defaultKeepId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged?: (result: AdminMergeResult) => void;
}

const accountLabel = (account: MergeAccountOption) =>
  `${account.name || 'Sem nome'} — ${account.email || 'sem e-mail'} (#${account.id})`;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Tente de novo em instantes.');

/**
 * REA-96: the one confirmation of a merge, from the user's page and from the duplicate CPF list.
 * The admin picks the account that stays (and, in a bigger group, the one to join into it), sees
 * what moves and why it may not be possible, and only then clicks "Juntar". The BFF checks it all
 * again.
 */
export function UserMergeDialog({ accounts, defaultKeepId, open, onOpenChange, onMerged }: UserMergeDialogProps) {
  const { toast } = useToast();
  const [keepId, setKeepId] = useState<string | null>(defaultKeepId ?? null);
  const [dropId, setDropId] = useState<string | null>(null);

  // Each opening starts from the suggestion.
  useEffect(() => {
    if (!open) return;
    setKeepId(defaultKeepId ?? null);
    setDropId(null);
  }, [open, defaultKeepId]);

  const others = accounts.filter((account) => account.id !== keepId);
  // With two accounts the one to join is the other; in a bigger group the admin picks it.
  const effectiveDropId = others.length === 1 ? others[0].id : dropId && dropId !== keepId ? dropId : null;

  const { data, loading, error } = useQuery<{ adminMergePreview: AdminMergePreview }>(ADMIN_MERGE_PREVIEW, {
    variables: { keepUserId: keepId, dropUserId: effectiveDropId },
    skip: !open || !keepId || !effectiveDropId,
    fetchPolicy: 'network-only',
  });
  const preview = keepId && effectiveDropId ? data?.adminMergePreview : undefined;

  const [mergeUsers, { loading: merging }] = useMutation<{ adminMergeUsers: AdminMergeResult }>(ADMIN_MERGE_USERS, {
    refetchQueries: ['AdminDuplicateCpfGroups', 'AdminUserProfile', 'AdminUsers'],
    awaitRefetchQueries: false,
  });

  const confirm = async () => {
    if (!keepId || !effectiveDropId) return;
    try {
      const { data: done } = await mergeUsers({ variables: { keepUserId: keepId, dropUserId: effectiveDropId } });
      const result = done?.adminMergeUsers;
      toast({ title: 'Contas juntadas', description: result?.message });
      onOpenChange(false);
      if (result) onMerged?.(result);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível juntar as contas', description: errorMessage(err) });
    }
  };

  const moves = preview ? mergeMoveLines(preview) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Juntar contas</DialogTitle>
          <DialogDescription>
            Tudo o que está na conta descartada passa para a conta que fica. Confira antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">Qual conta fica?</p>
          <RadioGroup value={keepId ?? ''} onValueChange={setKeepId} aria-label="Conta que fica">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-2">
                <RadioGroupItem value={account.id} id={`keep-${account.id}`} />
                <Label htmlFor={`keep-${account.id}`} className="font-normal break-all">
                  {accountLabel(account)}
                  {account.id === defaultKeepId ? <span className="ml-2 text-xs text-primary">sugerida</span> : null}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {keepId && others.length > 1 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Qual conta juntar a ela?</p>
            <RadioGroup value={dropId ?? ''} onValueChange={setDropId} aria-label="Conta descartada">
              {others.map((account) => (
                <div key={account.id} className="flex items-center gap-2">
                  <RadioGroupItem value={account.id} id={`drop-${account.id}`} />
                  <Label htmlFor={`drop-${account.id}`} className="font-normal break-all">{accountLabel(account)}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ) : null}

        {!keepId ? <p className="text-sm text-muted-foreground">Escolha a conta que fica para ver o que muda.</p> : null}
        {keepId && effectiveDropId && loading && !preview ? (
          <p className="text-sm text-muted-foreground">Conferindo o que muda…</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">Não foi possível conferir: {error.message}</p> : null}

        {preview ? (
          <div className="space-y-3 rounded-md border p-3 text-sm" data-testid="merge-preview">
            <p>
              Fica: <strong className="break-all">{preview.keep?.email || `#${keepId}`}</strong>
              <br />
              Descartada: <strong className="break-all">{preview.drop?.email || `#${effectiveDropId}`}</strong>
            </p>
            {preview.blockers.length > 0 ? (
              <ul className="space-y-1 text-destructive" aria-label="Por que não dá para juntar">
                {preview.blockers.map((blocker) => (
                  <li key={blocker} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {blocker}
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <div>
                  <p className="font-medium">O que passa para a conta que fica</p>
                  {moves.length > 0 ? (
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {moves.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">A conta descartada não tem nada ligado a ela.</p>
                  )}
                </div>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {mergeNotes(preview).map((note) => <li key={note}>{note}</li>)}
                </ul>
              </>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={!preview?.canMerge || loading || merging}
          >
            {merging ? 'Juntando...' : 'Juntar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
