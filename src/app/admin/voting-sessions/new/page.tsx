'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { VotingSessionForm } from '@/components/admin/voting-session-form';
import { FadeIn } from '@/components/animations';
import { useToast } from '@/hooks/use-toast';
import { VotingSessionInput } from '@/lib/types';

export default function NewVotingSessionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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

      const res = await fetch('https://manager.hubcommunity.io/api/voting-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: input }),
      });

      if (!res.ok) {
        throw new Error('Falha ao criar sessão de votação');
      }

      toast({
        title: 'Sessão criada',
        description: 'A sessão de votação foi criada com sucesso.',
      });

      const resData = await res.json();
      return resData.data.documentId;
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
      <div className="w-full py-10 px-4">
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
