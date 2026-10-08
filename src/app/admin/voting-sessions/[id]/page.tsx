'use client';

import { useApolloClient } from '@apollo/client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { VotingSessionForm } from '@/components/admin/voting-session-form';
import { FadeIn } from '@/components/animations';
import { useToast } from '@/hooks/use-toast';
import { GET_VOTING_SESSION, UPDATE_VOTING_SESSION } from '@/lib/queries';
import { VotingSession, VotingSessionInput } from '@/lib/types';

export default function EditVotingSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const client = useApolloClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);

  const documentId = params.id as string;

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await client.query<{ votingSession: VotingSession | null }>({
          query: GET_VOTING_SESSION,
          variables: { id: documentId },
          fetchPolicy: 'network-only',
        });
        const session = data?.votingSession;
        if (!session) throw new Error('Falha ao buscar sessão de votação');

        setInitialData({
          title: session.title,
          description: session.description || '',
          status: session.status,
          max_votes_per_user: session.max_votes_per_user,
          event_id: session.event_id || '',
          voting_options: session.voting_options || [],
          documentId: session.documentId || documentId,
        });
      } catch (error) {
        console.error('Error fetching session:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar',
          description: 'Não foi possível carregar os detalhes da sessão.',
        });
        router.push('/admin/voting-sessions');
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchSession();
    }
  }, [client, documentId, router, toast]);

  const handleSubmit = async (data: any) => {
    try {
      setSaving(true);
      
      const input: VotingSessionInput = {
        title: data.title,
        description: data.description || '',
        status: data.status,
        max_votes_per_user: Number(data.max_votes_per_user),
        event_id: data.event_id || undefined,
      };

      await client.mutate({
        mutation: UPDATE_VOTING_SESSION,
        variables: { id: documentId, data: input },
      });

      toast({
        title: 'Sessão atualizada',
        description: 'A sessão de votação foi atualizada com sucesso.',
      });

      return documentId;
    } catch (error) {
      console.error('Error updating voting session:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description:
          'Não foi possível atualizar a sessão. Verifique os dados e tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4 max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3 mb-8"></div>
          <div className="h-[400px] bg-muted border rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto py-10 px-4 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Editar Sessão de Votação</h1>
          <p className="text-muted-foreground mt-2">
            Atualize os detalhes da sessão de votação de pitchs.
          </p>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          {initialData && (
            <VotingSessionForm 
              initialData={initialData} 
              onSubmit={handleSubmit} 
              isLoading={saving} 
            />
          )}
        </div>
      </div>
    </FadeIn>
  );
}
