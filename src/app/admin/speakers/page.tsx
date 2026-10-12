'use client';

import { useApolloClient, useMutation } from '@apollo/client';
import { Loader2, Mic, Plus, Search, Star, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

import { FadeIn } from '@/components/animations';
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
  GET_SPEAKERS,
} from '@/lib/queries';
import { fetchAllSpeakers, matchesSpeakerName } from '@/lib/speaker-options';
import type { Speaker } from '@/lib/types';

export default function SpeakersAdminPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [creating, setCreating] = useState(false);

  // Every page of the list: the BFF returns 25 per page by default.
  const client = useApolloClient();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setSpeakers(await fetchAllSpeakers(client, GET_SPEAKERS));
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
      refetch();
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
      refetch();
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

  // Filter speakers by search
  const filtered = search.trim()
    ? speakers.filter((s) => matchesSpeakerName(s.name, search))
    : speakers;

  if (loading) {
    return (
      <div className="container mx-auto py-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 text-center text-red-500">
        <p>Erro ao carregar palestrantes: {error.message}</p>
      </div>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto py-10 px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Gerenciar Palestrantes
            </h1>
            <p className="text-muted-foreground mt-2">
              {speakers.length} palestrante{speakers.length !== 1 ? 's' : ''} cadastrado{speakers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Palestrante
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
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

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Avatar</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Destaque</TableHead>
                <TableHead className="hidden md:table-cell">Palestras</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
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
      </div>

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
