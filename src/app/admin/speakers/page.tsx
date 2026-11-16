'use client';

import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { Link2, Loader2, Mic, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

import { AdminPage, AdminPageError, AdminPageHeader, AdminPageLoading } from '@/components/admin/admin-page';
import {
  SpeakerEditDialog,
  accountLabel,
  linkedToast,
  useLinkSpeakerAccount,
} from '@/components/admin/speaker-edit-dialog';
import { FadeIn } from '@/components/animations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  CREATE_SPEAKER,
  DELETE_SPEAKER,
  GET_ADMIN_SPEAKERS,
  SPEAKER_ACCOUNT_REVIEW,
} from '@/lib/queries';
import {
  filterByAccount,
  type AccountFilter,
  type SpeakerAccountReview,
  type SpeakerLinkSuggestion,
} from '@/lib/speaker-accounts';
import { fetchAllSpeakers, matchesSpeakerName } from '@/lib/speaker-options';
import type { Speaker } from '@/lib/types';

export default function SpeakersAdminPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // Every page of the list: the BFF returns 25 per page by default.
  const client = useApolloClient();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setSpeakers(await fetchAllSpeakers(client, GET_ADMIN_SPEAKERS));
      setError(null);
    } catch (err) {
      console.error('Error loading speakers:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // REA-53: how many speakers are accounts, and the suggested links (admin only in the BFF).
  const review = useQuery<{ speakerAccountReview: SpeakerAccountReview }>(SPEAKER_ACCOUNT_REVIEW, {
    fetchPolicy: 'network-only',
  });
  const refetchReview = review.refetch;
  const refreshAll = useCallback(() => {
    refetch();
    refetchReview().catch(() => undefined);
  }, [refetch, refetchReview]);

  const [deleteSpeaker] = useMutation(DELETE_SPEAKER);
  const [createSpeaker] = useMutation(CREATE_SPEAKER);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${name}"?`)) return;

    try {
      await deleteSpeaker({ variables: { id } });
      toast({
        title: 'Palestrante excluído',
        description: `"${name}" foi removido com sucesso.`,
      });
      refreshAll();
    } catch (err) {
      console.error('Error deleting speaker:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o palestrante.',
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpeakerName.trim()) return;

    setCreating(true);
    try {
      await createSpeaker({
        variables: { data: { name: newSpeakerName.trim() } },
      });
      toast({
        title: 'Palestrante criado',
        description: `"${newSpeakerName.trim()}" foi adicionado com sucesso.`,
      });
      setNewSpeakerName('');
      setIsCreateOpen(false);
      refreshAll();
    } catch (err) {
      console.error('Error creating speaker:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar',
        description: 'Não foi possível criar o palestrante.',
      });
    } finally {
      setCreating(false);
    }
  };

  // Filter speakers by search and by account (REA-53)
  const filtered = filterByAccount(
    search.trim() ? speakers.filter((s) => matchesSpeakerName(s.name, search)) : speakers,
    accountFilter,
  );
  const summary = review.data?.speakerAccountReview;

  if (loading) return <AdminPageLoading label="Carregando palestrantes" />;

  if (error) {
    return <AdminPageError title="Erro ao carregar palestrantes" message={error.message} />;
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <AdminPage>
        <AdminPageHeader
          title="Palestrantes"
          description={`${speakers.length} palestrante${speakers.length !== 1 ? 's' : ''} cadastrado${speakers.length !== 1 ? 's' : ''}`}
          actions={
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Palestrante
            </Button>
          }
        />

        {summary && (
          <div
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            data-testid="speaker-account-summary"
          >
            <div className="text-sm">
              <div className="font-medium">
                {summary.withAccount} de {summary.total} palestrantes têm conta vinculada
              </div>
              <div className="text-muted-foreground">
                {summary.withoutAccount} sem conta
                {summary.withoutAccountWithTalks > 0 &&
                  ` (${summary.withoutAccountWithTalks} com palestras)`}
                . O palestrante vai passar a ser uma conta do sistema.
              </div>
            </div>
            {summary.suggestions.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setSuggestionsOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />
                Sugestões de vínculo ({summary.suggestions.length})
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar palestrante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1" role="group" aria-label="Filtrar por conta">
          {([
            ['all', 'Todos'],
            ['linked', 'Com conta'],
            ['unlinked', 'Sem conta'],
          ] as [AccountFilter, string][]).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={accountFilter === value ? 'secondary' : 'ghost'}
              aria-pressed={accountFilter === value}
              onClick={() => setAccountFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Avatar</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="hidden sm:table-cell">Destaque</TableHead>
                <TableHead className="hidden md:table-cell">Palestras</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    {search
                      ? 'Nenhum palestrante encontrado para esta busca.'
                      : 'Nenhum palestrante cadastrado.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((speaker) => (
                  <TableRow key={speaker.id}>
                    <TableCell>
                      {speaker.avatar ? (
                        <Image
                          src={speaker.avatar}
                          alt={speaker.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Mic className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {speaker.name}
                    </TableCell>
                    <TableCell>
                      {speaker.account ? (
                        <div className="min-w-0" data-testid={`speaker-account-${speaker.id}`}>
                          <div className="truncate text-sm">{accountLabel(speaker.account)}</div>
                          {speaker.account.name && speaker.account.email && (
                            <div className="truncate text-xs text-muted-foreground">
                              {speaker.account.email}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          Sem conta
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {speaker.highlight ? (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {speaker.talks && speaker.talks.length > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {speaker.talks.length} palestra{speaker.talks.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          aria-label={`Editar ${speaker.name}`}
                          onClick={() => setEditing(speaker)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          title="Excluir"
                          onClick={() => handleDelete(speaker.id, speaker.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </AdminPage>

      <SpeakerEditDialog
        speaker={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onChanged={refreshAll}
      />

      <SpeakerSuggestionsDialog
        open={suggestionsOpen}
        onOpenChange={setSuggestionsOpen}
        suggestions={summary?.suggestions ?? []}
        onLinked={refreshAll}
      />

      {/* Create Speaker Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Novo Palestrante</DialogTitle>
            <DialogDescription>
              Adicione um novo palestrante ao sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="speaker-name">Nome</Label>
              <Input
                id="speaker-name"
                placeholder="Nome do palestrante"
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating || !newSpeakerName.trim()}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Palestrante'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
}

/** REA-53: links suggested by the BFF (same e-mail, or a name only one account has); each one is confirmed. */
function SpeakerSuggestionsDialog({
  open,
  onOpenChange,
  suggestions,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: SpeakerLinkSuggestion[];
  onLinked: () => void;
}) {
  const { toast } = useToast();
  const { link } = useLinkSpeakerAccount();
  const [busy, setBusy] = useState<string | null>(null);

  const confirmLink = async (suggestion: SpeakerLinkSuggestion) => {
    if (!suggestion.account.id) return;
    setBusy(suggestion.speakerId);
    try {
      const joined = await link(suggestion.speakerId, suggestion.account.id);
      toast(linkedToast(suggestion.account, joined));
      onLinked();
    } catch (err) {
      const apollo = err as { graphQLErrors?: { message?: string }[] };
      toast({
        variant: 'destructive',
        title: apollo?.graphQLErrors?.[0]?.message || 'Não foi possível vincular.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Sugestões de vínculo</DialogTitle>
          <DialogDescription>
            Palestrantes sem conta com o mesmo e-mail de uma conta, ou com um nome que só uma conta
            tem. Nada é vinculado sem a sua confirmação; confira o nome antes.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-lg border" aria-label="Sugestões de vínculo">
          {suggestions.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Nenhuma sugestão.</li>
          )}
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.speakerId}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 text-sm">
                <div className="font-medium">
                  {suggestion.speakerName || 'Sem nome'}
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    · {suggestion.talks} palestra{suggestion.talks === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="truncate text-muted-foreground">
                  → {accountLabel(suggestion.account)}
                  {suggestion.account.name && suggestion.account.email ? ` (${suggestion.account.email})` : ''}
                </div>
                <Badge variant="secondary" className="mt-1 font-normal">
                  {suggestion.reason === 'EMAIL' ? 'Mesmo e-mail' : 'Mesmo nome'}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                aria-label={`Vincular ${suggestion.speakerName || 'palestrante'} a ${suggestion.account.email || suggestion.account.name}`}
                onClick={() => confirmLink(suggestion)}
              >
                {busy === suggestion.speakerId ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-1 h-4 w-4" />
                )}
                Vincular
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
