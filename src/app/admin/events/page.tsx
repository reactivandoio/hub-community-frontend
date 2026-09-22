'use client';

import { useMutation, useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Plus, Trash2, Award, BarChart3, ClipboardList, EyeOff, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { EventsTableSkeleton } from '@/components/admin/events-table-skeleton';
import { FadeIn } from '@/components/animations';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { bulkEmailToast } from '@/lib/bulk-email';
import { DELETE_EVENT, GET_EVENTS, SEND_IMPORTED_SIGNUP_CONFIRMATIONS } from '@/lib/queries';
import {
  DeleteEventResponse,
  EventsResponse,
  SendImportedSignupConfirmationsResponse,
} from '@/lib/types';

interface EmailTarget {
  /** Same identifier the Checkin mutations (importSignups) take as eventSlug. */
  eventSlug: string;
  title: string;
}

export default function EventsAdminPage() {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useQuery<EventsResponse>(
    GET_EVENTS,
    {
      variables: { sort: [{ start_date: 'DESC' }], include_unlisted: true },
    }
  );
  const [deleteEvent] = useMutation<DeleteEventResponse>(DELETE_EVENT);
  const [sendConfirmations, { loading: sendingEmails }] =
    useMutation<SendImportedSignupConfirmationsResponse>(SEND_IMPORTED_SIGNUP_CONFIRMATIONS);
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null);

  const handleSendConfirmations = async () => {
    if (!emailTarget) return;
    try {
      const { data } = await sendConfirmations({
        variables: { eventSlug: emailTarget.eventSlug },
      });
      toast(bulkEmailToast(data?.sendImportedSignupConfirmations));
    } catch (error) {
      console.error('Error sending imported signup confirmations:', error);
      toast(
        bulkEmailToast({
          success: false,
          message: error instanceof Error ? error.message : null,
          queued_count: 0,
        })
      );
    } finally {
      setEmailTarget(null);
    }
  };

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
                      <div className="flex items-center gap-2">
                        <span>{event.title}</span>
                        {event.unlisted && (
                          <Badge variant="secondary" className="gap-1 font-normal">
                            <EyeOff className="h-3 w-3" />
                            Não listado
                          </Badge>
                        )}
                      </div>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Enviar confirmação aos importados"
                        onClick={() =>
                          setEmailTarget({
                            eventSlug: event.slug || event.documentId || String(event.id),
                            title: event.title,
                          })
                        }
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
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

      <AlertDialog
        open={emailTarget !== null}
        onOpenChange={(open) => {
          if (!open && !sendingEmails) setEmailTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar confirmação — {emailTarget?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              Enviar email de confirmação com QR para os inscritos importados deste evento? Quem
              já recebeu vai receber de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingEmails}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={sendingEmails}
              onClick={(e) => {
                e.preventDefault();
                handleSendConfirmations();
              }}
            >
              {sendingEmails ? 'Enviando...' : 'Enviar emails'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </FadeIn>
  );
}
