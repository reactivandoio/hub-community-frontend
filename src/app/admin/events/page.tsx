'use client';

import { useMutation, useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Plus, Trash2, Award, BarChart3, ClipboardList } from 'lucide-react';
import Link from 'next/link';

import { EventsTableSkeleton } from '@/components/admin/events-table-skeleton';
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
import { DELETE_EVENT, GET_EVENTS } from '@/lib/queries';
import { DeleteEventResponse, EventsResponse } from '@/lib/types';

export default function EventsAdminPage() {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useQuery<EventsResponse>(
    GET_EVENTS,
    {
      variables: { sort: [{ start_date: 'DESC' }] },
    }
  );
  const [deleteEvent] = useMutation<DeleteEventResponse>(DELETE_EVENT);

  const handleDelete = async (documentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      await deleteEvent({ variables: { documentId } });
      toast({
        title: 'Evento excluído',
        description: 'O evento foi removido com sucesso.',
      });
      refetch();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o evento.',
      });
    }
  };

  if (loading) {
    return <EventsTableSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 text-center text-red-500">
        <p>Erro ao carregar eventos: {error.message}</p>
      </div>
    );
  }

  const events = data?.events?.data || [];

  return (
    <FadeIn direction="up" duration={0.3}>
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gerenciar Eventos
          </h1>
          <p className="text-muted-foreground mt-2">
            Crie, edite e gerencie os eventos da comunidade.
          </p>
        </div>
        <Link href="/admin/events/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Evento
          </Button>
        </Link>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Data de Início</TableHead>
              <TableHead>Data de Término</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Nenhum evento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              events.map(event => (
                <TableRow key={event.documentId || event.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{event.title}</span>
                      <span className="text-xs text-muted-foreground">
                        /{event.slug}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(
                      new Date(event.start_date),
                      "dd 'de' MMMM 'de' yyyy, HH:mm",
                      { locale: ptBR }
                    )}
                  </TableCell>
                  <TableCell>
                    {format(
                      new Date(event.end_date),
                      "dd 'de' MMMM 'de' yyyy, HH:mm",
                      { locale: ptBR }
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/events/${event.documentId}/analytics`}>
                        <Button variant="ghost" size="icon" title="Analytics">
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/events/${event.documentId}/attendance`}>
                        <Button variant="ghost" size="icon" title="Lista de Presença">
                          <ClipboardList className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/events/${event.documentId}/certificados`}>
                        <Button variant="ghost" size="icon" title="Certificados">
                          <Award className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/events/${event.documentId}`}>
                        <Button variant="ghost" size="icon" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        title="Excluir"
                        onClick={() =>
                          event.documentId && handleDelete(event.documentId)
                        }
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
