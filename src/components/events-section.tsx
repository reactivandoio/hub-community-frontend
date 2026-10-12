'use client';

import { useMutation, useQuery } from '@apollo/client';
import { Calendar, Clock, MapPin, Plus, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { StaggerContainer, StaggerItem } from '@/components/animations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExpandableRichText } from '@/components/ui/expandable-rich-text';
import { useAgenda } from '@/contexts/agenda-context';
import { useFilters } from '@/contexts/filter-context';
import { useWithLogin } from '@/contexts/login-prompt-context';
import { CREATE_AGENDA, GET_EVENTS } from '@/lib/queries';
import { Event, EventsResponse } from '@/lib/types';
import { adjustToBrazilTimezone } from '@/utils/event';

export function EventsSection({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const { debouncedSearchTerm } = useFilters();
  const { agendas, refetchAgendas } = useAgenda();
  const withLogin = useWithLogin();

  const [createAgendaMutation] = useMutation(CREATE_AGENDA);

  const { data, error } = useQuery<EventsResponse>(GET_EVENTS, {
    variables: {
      filters: debouncedSearchTerm
        ? { title: { contains: debouncedSearchTerm } }
        : {},
      sort: [{ start_date: 'ASC' }],
    },
  });

  // Filter future events (events that haven't ended yet) and sort nearest first
  const futureEvents =
    (data?.events?.data?.filter(event => {
      if (!event.end_date) return true; // If no end date, consider it future
      const eventEndDate = new Date(event.end_date);
      const now = new Date();
      return eventEndDate >= now;
    }) || []).sort((a, b) => {
      const dateA = a.start_date ? new Date(a.start_date).getTime() : Infinity;
      const dateB = b.start_date ? new Date(b.start_date).getTime() : Infinity;
      return dateA - dateB;
    });

  // Call the onCountChange callback if provided
  React.useEffect(() => {
    if (onCountChange) {
      onCountChange(futureEvents.length);
    }
  }, [onCountChange, futureEvents.length]);

  // Helper function to check if event has already happened
  const isEventPast = (event: Event) => {
    if (!event.end_date) return false;
    const eventEndDate = new Date(event.end_date);
    const now = new Date();
    return eventEndDate < now;
  };

  // Helper function to check if event is in user's agenda
  const isEventInAgenda = (event: Event) => {
    return agendas.some(
      agenda => agenda.event?.documentId === event.documentId
    );
  };

  // Helper function to handle agenda creation
  const createAgenda = async (event: Event) => {
    try {
      await createAgendaMutation({
        variables: {
          input: {
            event: event.documentId,
            is_public: false,
          },
        },
      });
      // Refresh agendas after creation
      await refetchAgendas();
    } catch (error) {
      console.error('Error creating agenda:', error);
    }
  };

  // Signed out: the login opens over the list and the event goes to the agenda after it.
  const handleCreateAgenda = (event: Event) =>
    withLogin(() => createAgenda(event), 'Entre para salvar o evento na sua agenda');

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Erro de Conexão
          </h3>
          <p className="text-red-600 mb-4">
            Não foi possível conectar ao servidor GraphQL. Verifique se o
            servidor está rodando.
          </p>
          <details className="text-sm text-red-500">
            <summary className="cursor-pointer">Detalhes do erro</summary>
            <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  if (futureEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          {debouncedSearchTerm
            ? 'Nenhum evento encontrado com os filtros aplicados.'
            : 'Nenhum evento disponível no momento.'}
        </p>
      </div>
    );
  }

  return (
    <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {futureEvents.map((event: Event) => (
        <StaggerItem key={event.id} className="h-full">
          <Link href={`/events/${event.slug || event.id}`} className="block group h-full">
            <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-border/60 hover:border-primary/30 h-full flex flex-col">
              {/* Event Image */}
              <div className="relative overflow-hidden">
                <Image
                  src={
                    Array.isArray(event.images) && event.images.length > 0
                      ? event.images[0]
                      : '/placeholder.svg'
                  }
                  alt={typeof event.title === 'string' ? event.title : 'Event'}
                  width={400}
                  height={300}
                  className="aspect-[4/3] w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  unoptimized
                />
              </div>

              {/* Event Info */}
              <CardContent className="p-4 flex flex-col flex-1">
                {/* Title */}
                <h3 className="font-bold text-foreground text-lg leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {typeof event.title === 'string' ? event.title : 'Evento'}
                </h3>

                {/* Date & Location - single line */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mb-3">
                  {typeof event.start_date === 'string' && (
                    <span>
                      {adjustToBrazilTimezone(
                        new Date(event.start_date)
                      ).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      {adjustToBrazilTimezone(
                        new Date(event.start_date)
                      ).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  {event.location?.title && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location.city || event.location.title}
                      </span>
                    </>
                  )}
                </div>

                {/* Bottom row - always rendered for consistent height */}
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {event.communities.length > 0
                      ? <>por <span className="font-medium text-foreground/80">{event.communities[0]?.title}</span></>
                      : '\u00A0'}
                  </span>
                  {event.talks.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {event.talks.length} palestra{event.talks.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
