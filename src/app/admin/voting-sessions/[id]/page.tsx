'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { VotingSessionForm } from '@/components/admin/voting-session-form';
import { AdminPage, AdminPageHeader, AdminPageLoading } from '@/components/admin/admin-page';
import { FadeIn } from '@/components/animations';
import { useToast } from '@/hooks/use-toast';
import { VotingSessionInput, VotingSessionResponse } from '@/lib/types';

export default function EditVotingSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);

  const documentId = params.id as string;

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`https://manager.hubcommunity.io/api/voting-sessions/${documentId}?populate=*`);
        if (!res.ok) throw new Error('Falha ao buscar sessão de votação');
        
        const data: VotingSessionResponse = await res.json();
        const session = data.data;

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
  }, [documentId, router, toast]);

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

      const res = await fetch(`https://manager.hubcommunity.io/api/voting-sessions/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: input }),
      });

      if (!res.ok) {
        throw new Error('Falha ao atualizar sessão de votação');
      }

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

  if (loading) return <AdminPageLoading label="Carregando a sessão de votação" />;

  return (
    <FadeIn direction="up" duration={0.3}>
      <AdminPage>
        <AdminPageHeader
          title="Editar Sessão de Votação"
          description="Atualize os detalhes da sessão de votação de pitchs."
        />

        <div className="border rounded-lg p-6 bg-card">
          {initialData && (
            <VotingSessionForm 
              initialData={initialData} 
              onSubmit={handleSubmit} 
              isLoading={saving} 
            />
          )}
        </div>
      </AdminPage>
    </FadeIn>
  );
}
