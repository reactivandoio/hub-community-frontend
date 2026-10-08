'use client';

import { useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { VotingSessionForm } from '@/components/admin/voting-session-form';
import { FadeIn } from '@/components/animations';
import { useToast } from '@/hooks/use-toast';
import { CREATE_VOTING_SESSION } from '@/lib/queries';
import { VotingSession, VotingSessionInput } from '@/lib/types';

export default function NewVotingSessionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [createVotingSession] = useMutation<{ createVotingSession: VotingSession }>(
    CREATE_VOTING_SESSION,
  );

  const handleSubmit = async (data: any) => {
    try {
      setLoading(true);
      
      const input: VotingSessionInput = {
        title: data.title,
        description: data.description || '',
        status: data.status,
        max_votes_per_user: Number(data.max_votes_per_user),
      };

      if (data.event_id) {
        input.event_id = data.event_id;
      }

      const { data: created } = await createVotingSession({ variables: { data: input } });
      if (!created?.createVotingSession) {
        throw new Error('Falha ao criar sessão de votação');
      }

      toast({
        title: 'Sessão criada',
        description: 'A sessão de votação foi criada com sucesso.',
      });

      return created.createVotingSession.documentId;
    } catch (error) {
      console.error('Error creating voting session:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar',
        description:
          'Não foi possível criar a sessão. Verifique os dados e tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto py-10 px-4 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Nova Sessão de Votação</h1>
          <p className="text-muted-foreground mt-2">
            Preencha os detalhes abaixo para criar uma nova sessão de votação.
          </p>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <VotingSessionForm onSubmit={handleSubmit} isLoading={loading} />
        </div>
      </div>
    </FadeIn>
  );
}
