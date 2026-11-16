'use client';

import { useMutation, useQuery } from '@apollo/client';
import { Link2, Loader2, Search, Unlink } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  LINK_SPEAKER_ACCOUNT,
  SPEAKER_ACCOUNT_SEARCH,
  UNLINK_SPEAKER_ACCOUNT,
  UPDATE_SPEAKER,
} from '@/lib/queries';
import type { Speaker, SpeakerAccount } from '@/lib/types';

/**
 * REA-53 — edit a speaker in /admin/speakers (admin only) and link it to the account it is.
 * Medium term speakers become accounts; this link is the bridge.
 */

const errorMessage = (err: unknown) => {
  const apollo = err as { graphQLErrors?: { message?: string }[] };
  return apollo?.graphQLErrors?.[0]?.message || 'Não foi possível concluir. Tente novamente.';
};

export const accountLabel = (account: Pick<SpeakerAccount, 'name' | 'email'> | null | undefined) =>
  account?.name || account?.email || 'Conta sem nome';

/** The toast after a link: says when the empty speaker of the account's first login was joined. */
export const linkedToast = (account: Pick<SpeakerAccount, 'name' | 'email'>, joined: string[] = []) => ({
  title: `Vinculado a ${accountLabel(account)}.`,
  description: joined.length
    ? `O perfil vazio criado no primeiro login da conta (${joined.join(', ')}) foi juntado a este palestrante.`
    : undefined,
});

/** Links an account; resolves the names of the empty speakers joined into this one. */
export function useLinkSpeakerAccount() {
  const [link, { loading }] = useMutation<{ linkSpeakerAccount: { joined: string[] } }>(LINK_SPEAKER_ACCOUNT);
  return {
    loading,
    link: async (speakerId: string, userId: string) => {
      const { data } = await link({ variables: { speakerId, userId } });
      return data?.linkSpeakerAccount?.joined ?? [];
    },
  };
}

interface SearchAccount extends SpeakerAccount {
  username?: string | null;
  blocked?: boolean | null;
}

interface AccountSectionProps {
  speaker: Speaker;
  onChanged: () => void;
}

/** The account the speaker is, or a search to link one. */
export function SpeakerAccountSection({ speaker, onChanged }: AccountSectionProps) {
  const { toast } = useToast();
  const [account, setAccount] = useState<SpeakerAccount | null>(speaker.account ?? null);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const { link, loading: linking } = useLinkSpeakerAccount();
  const [unlink, { loading: unlinking }] = useMutation(UNLINK_SPEAKER_ACCOUNT);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const { data, loading } = useQuery<{ adminUsers: { total: number; items: SearchAccount[] } }>(
    SPEAKER_ACCOUNT_SEARCH,
    { variables: { search: debounced }, skip: account !== null || debounced.length < 2, fetchPolicy: 'network-only' },
  );

  const doLink = async (candidate: SearchAccount) => {
    if (!candidate.id) return;
    try {
      const joined = await link(speaker.id, candidate.id);
      setAccount(candidate);
      setTerm('');
      toast(linkedToast(candidate, joined));
      onChanged();
    } catch (err) {
      toast({ variant: 'destructive', title: errorMessage(err) });
    }
  };

  const doUnlink = async () => {
    try {
      await unlink({ variables: { speakerId: speaker.id } });
      setAccount(null);
      setConfirmUnlink(false);
      toast({ title: 'Conta desvinculada. O palestrante e as palestras continuam.' });
      onChanged();
    } catch (err) {
      toast({ variant: 'destructive', title: errorMessage(err) });
    }
  };

  if (account) {
    return (
      <div className="space-y-2" data-testid="speaker-account">
        <Label>Conta vinculada</Label>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{accountLabel(account)}</div>
            {account.name && account.email && (
              <div className="truncate text-xs text-muted-foreground">{account.email}</div>
            )}
          </div>
          {confirmUnlink ? (
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmUnlink(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" size="sm" disabled={unlinking} onClick={doUnlink}>
                {unlinking && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmUnlink(true)}>
              <Unlink className="mr-1 h-4 w-4" />
              Desvincular
            </Button>
          )}
        </div>
      </div>
    );
  }

  const results = data?.adminUsers.items ?? [];
  return (
    <div className="space-y-2">
      <Label htmlFor="speaker-account-search">Vincular a uma conta</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="speaker-account-search"
          className="pl-10"
          placeholder="Buscar conta por nome ou e-mail"
          value={term}
          onChange={e => setTerm(e.target.value)}
        />
      </div>
      {debounced.length >= 2 && (
        <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border" aria-label="Contas encontradas">
          {loading && <li className="p-3 text-sm text-muted-foreground">Buscando…</li>}
          {!loading && results.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Nenhuma conta encontrada.</li>
          )}
          {results.map(candidate => (
            <li key={candidate.id ?? candidate.documentId} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{candidate.name || candidate.username || candidate.email}</div>
                <div className="truncate text-xs text-muted-foreground">{candidate.email}</div>
              </div>
              {candidate.blocked ? (
                <Badge variant="secondary">Desativada</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={linking}
                  aria-label={`Vincular a ${candidate.email || candidate.name}`}
                  onClick={() => doLink(candidate)}
                >
                  <Link2 className="mr-1 h-4 w-4" />
                  Vincular
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        A conta passa a ser este palestrante. Se ela já tiver o perfil vazio criado no primeiro login,
        ele é juntado a este.
      </p>
    </div>
  );
}

interface SpeakerEditDialogProps {
  speaker: Speaker | null;
  onOpenChange: (open: boolean) => void;
  /** After any change (data saved, account linked or unlinked): the list fetches again. */
  onChanged: () => void;
}

export function SpeakerEditDialog({ speaker, onOpenChange, onChanged }: SpeakerEditDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [highlight, setHighlight] = useState(false);
  const [biography, setBiography] = useState<unknown[]>([]);
  const [biographyTouched, setBiographyTouched] = useState(false);
  const [update, { loading }] = useMutation(UPDATE_SPEAKER);

  useEffect(() => {
    if (!speaker) return;
    setName(speaker.name || '');
    setHighlight(Boolean(speaker.highlight));
    setBiography(Array.isArray(speaker.biography) ? speaker.biography : []);
    setBiographyTouched(false);
  }, [speaker]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!speaker || name.trim().length < 2) return;
    try {
      await update({
        variables: {
          id: speaker.id,
          // The biography goes only when edited: an old text biography is never wiped.
          data: { name: name.trim(), highlight, ...(biographyTouched ? { biography } : {}) },
        },
      });
      toast({ title: 'Palestrante atualizado.' });
      onChanged();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: errorMessage(err) });
    }
  };

  return (
    <Dialog open={!!speaker} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Editar palestrante</DialogTitle>
          <DialogDescription>
            Os dados aparecem nas palestras. A conta vinculada é a pessoa no sistema.
          </DialogDescription>
        </DialogHeader>
        {speaker && (
          <div className="space-y-6">
            <SpeakerAccountSection key={speaker.id} speaker={speaker} onChanged={onChanged} />
            <form onSubmit={submit} className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="speaker-edit-name">Nome</Label>
                <Input id="speaker-edit-name" value={name} onChange={e => setName(e.target.value)} required />
                {name.trim().length > 0 && name.trim().length < 2 && (
                  <p className="text-xs text-destructive">O nome deve ter pelo menos 2 caracteres.</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch id="speaker-edit-highlight" checked={highlight} onCheckedChange={setHighlight} />
                <Label htmlFor="speaker-edit-highlight">Destaque</Label>
              </div>
              <div className="space-y-2">
                <Label>Biografia</Label>
                <RichTextEditor
                  value={biography as never}
                  onChange={value => {
                    setBiography(value as unknown[]);
                    setBiographyTouched(true);
                  }}
                  placeholder="Biografia do palestrante..."
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading || name.trim().length < 2}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
