'use client';

import { useApolloClient } from '@apollo/client';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import Link from 'next/link';

import { FadeIn } from '@/components/animations';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { DELETE_VOTING_SESSION, GET_VOTING_SESSIONS } from '@/lib/queries';
import { VotingSession } from '@/lib/types';

export default function VotingSessionsAdminPage() {
  const { toast } = useToast();
  const client = useApolloClient();
  const [sessions, setSessions] = useState<VotingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data } = await client.query<{ votingSessions: VotingSession[] }>({
        query: GET_VOTING_SESSIONS,
        fetchPolicy: 'network-only',
      });
      setSessions(data?.votingSessions || []);
    } catch (err: any) {
      setError(err.message);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as sessões de votação.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleDelete = async (documentId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão de votação?')) return;

    try {
      await client.mutate({ mutation: DELETE_VOTING_SESSION, variables: { id: documentId } });

      toast({
        title: 'Sessão excluída',
        description: 'A sessão de votação foi removida com sucesso.',
      });
      fetchSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a sessão de votação.',
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted border rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 text-center text-red-500">
        <p>Erro: {error}</p>
      </div>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto py-10 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sessões de Votação</h1>
            <p className="text-muted-foreground mt-2">
              Crie, edite e gerencie as sessões de votação.
            </p>
          </div>
          <Link href="/admin/voting-sessions/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Sessão
            </Button>
          </Link>
        </div>

        <div className="border rounded-md bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Máx. Votos/User</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Nenhuma sessão encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.documentId || session.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{session.title}</span>
                        {session.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {session.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        session.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        session.status === 'closed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                        {session.status === 'open' ? 'Aberta' : session.status === 'closed' ? 'Fechada' : 'Arquivada'}
                      </span>
                    </TableCell>
                    <TableCell>{session.max_votes_per_user}</TableCell>
                    <TableCell>
                      {session.createdAt ? format(
                        new Date(session.createdAt),
                        "dd 'de' MMM 'de' yyyy",
                        { locale: ptBR }
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {session.status !== 'open' && (
                          <Link href={`/votacao/${session.documentId}/resultados`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="icon" title="Ver Resultados Oficiais" type="button" className="text-yellow-600 border-yellow-200 hover:bg-yellow-50 dark:hover:bg-yellow-950">
                              <Trophy className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <Link href={`/votacao/${session.documentId}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="icon" title="Acessar Página Pública" type="button">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/voting-sessions/${session.documentId}`}>
                          <Button variant="ghost" size="icon" title="Editar Sessão">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => session.documentId && handleDelete(session.documentId)}
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
    </FadeIn>
  );
}
