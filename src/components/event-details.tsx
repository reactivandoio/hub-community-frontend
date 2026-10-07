'use client';

import { useQuery } from '@apollo/client';
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ImagePlus,
  MapPin,
  Share2,
  Users,
  Video,
  Wifi,
  X,
  ZoomIn,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AddToCalendarButton } from '@/components/add-to-calendar-button';
import { FadeIn } from '@/components/animations';
import { EventDetailsSkeleton } from '@/components/event-details-skeleton';
import { TalkCard } from '@/components/talk-card';
import { Button } from '@/components/ui/button';
import { ExpandableRichText } from '@/components/ui/expandable-rich-text';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { usePageVisitTracker, useTracking } from '@/hooks/use-tracking';
import { trackViewEventDetail } from '@/lib/analytics';
import { GET_AGENDA_BY_EVENT_ID, GET_EVENT_BY_SLUG_OR_ID, IS_USER_SIGNED_UP } from '@/lib/queries';
import { adjustToBrazilTimezone } from '@/utils/event';

interface EventDetailsProps {
  slugOrId: string;
}

export function EventDetails({ slugOrId }: EventDetailsProps) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [optimisticAgendaTalks, setOptimisticAgendaTalks] = useState<
    Set<string>
  >(new Set());
  const [showLightbox, setShowLightbox] = useState(false);

  // Track event detail view (legacy)
  useEffect(() => {
    trackViewEventDetail(slugOrId);
  }, [slugOrId]);

  const { track } = useTracking();

  // Use eventBySlugOrId query that searches both slug and id
  const { data, loading, error } = useQuery<{ eventBySlugOrId: any }>(
    GET_EVENT_BY_SLUG_OR_ID,
    {
      variables: { slugOrId },
    }
  );

  // Extract event from query response
  const event = data?.eventBySlugOrId;

  // Track page visit via analytics system (after data is available)
  usePageVisitTracker(event?.documentId, `/events/${slugOrId}`);

  const {
    data: agendaData,
    loading: agendaLoading,
    refetch: refetchAgenda,
  } = useQuery(GET_AGENDA_BY_EVENT_ID, {
    variables: { eventId: event?.documentId || slugOrId },
    skip: !isAuthenticated || !event,
    fetchPolicy: 'cache-and-network',
  });

  // Check if user is already signed up
  const { data: signupCheckData } = useQuery(IS_USER_SIGNED_UP, {
    variables: { eventId: slugOrId, email: user?.email || '' },
    skip: !isAuthenticated || !user?.email,
    fetchPolicy: 'network-only',
  });

  const isAlreadySignedUp = signupCheckData?.isUserSignedUp?.is_signed_up;
  const callLink = signupCheckData?.isUserSignedUp?.call_link;

  // Check if event has internal registration (products with enabled batches)
  const hasInternalRegistration =
    event?.products?.some((p: any) => p.enabled && p.batches?.some((b: any) => b.enabled));

  // Handle agenda changes
  const handleAgendaChange = () => {
    setOptimisticAgendaTalks(new Set()); // Reset optimistic state
    refetchAgenda();
  };

  // Handle "Participar" button click
  const handleParticipate = () => {
    track({
      eventType: 'signup_click',
      eventDocumentId: event?.documentId,
      metadata: { route: `/events/${event?.slug || slugOrId}/signup` },
    });
    if (hasInternalRegistration) {
      router.push(`/events/${event?.slug || slugOrId}/signup`);
    } else if (event?.subscription_link) {
      window.open(event.subscription_link, '_blank');
    }
  };

  if (loading) {
    return <EventDetailsSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Erro ao carregar evento
          </h2>
          <p className="text-muted-foreground mb-4">
            Não foi possível carregar os detalhes do evento.
          </p>
          <Button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // Get agenda information
  const agenda = agendaData?.agendas?.data?.[0];
  const agendaTalkIds =
    agenda?.talks?.map((talk: any) => talk.documentId) || [];

  // Function to check if a talk is in the agenda (considering optimistic updates)
  const isTalkInAgenda = (talkDocumentId: string | undefined) => {
    if (!talkDocumentId) return false;
    return (
      agendaTalkIds.includes(talkDocumentId) ||
      optimisticAgendaTalks.has(talkDocumentId)
    );
  };

  // Function to handle optimistic updates
  const handleOptimisticUpdate = (
    talkDocumentId: string,
    isInAgenda: boolean
  ) => {
    setOptimisticAgendaTalks(prev => {
      const newSet = new Set(prev);
      if (isInAgenda) {
        newSet.add(talkDocumentId);
      } else {
        newSet.delete(talkDocumentId);
      }
      return newSet;
    });
  };

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Evento não encontrado
          </h2>
          <p className="text-muted-foreground">
            O evento que você está procurando não existe ou foi removido.
          </p>
        </div>
      </div>
    );
  }

  // Validate that required fields are present and are strings
  if (
    !event.start_date ||
    !event.end_date ||
    typeof event.start_date !== 'string' ||
    typeof event.end_date !== 'string'
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Dados do evento inválidos
          </h2>
          <p className="text-muted-foreground">
            Os dados do evento estão incompletos ou inválidos.
          </p>
        </div>
      </div>
    );
  }

  // Event start_date/end_date are proper UTC — display with explicit timezone
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);
  const TZ = 'America/Sao_Paulo';
  const isMultiDay =
    startDate.toLocaleDateString('pt-BR', { timeZone: TZ }) !==
    endDate.toLocaleDateString('pt-BR', { timeZone: TZ });

  // Talk occur_date is stored as local Brazil time but incorrectly tagged as UTC — strip Z
  const parseTalkDate = (isoStr: string) =>
    new Date(isoStr.replace(/Z$/i, ''));

  // Group talks by day and then by time
  const talksByDay =
    event.talks?.reduce(
      (acc: Record<string, Record<string, typeof event.talks>>, talk: any) => {
        if (!talk.occur_date) return acc;

        const rawDate = parseTalkDate(talk.occur_date);
        const dateKey = rawDate.toLocaleDateString('pt-BR');
        const timeKey = rawDate.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        if (!acc[dateKey]) {
          acc[dateKey] = {};
        }
        if (!acc[dateKey][timeKey]) {
          acc[dateKey][timeKey] = [];
        }
        acc[dateKey][timeKey].push(talk);
        return acc;
      },
      {} as Record<string, Record<string, typeof event.talks>>
    ) || {};

  // Sort date keys chronologically
  const sortedDateKeys = Object.keys(talksByDay).sort((a, b) => {
    const [aDay, aMonth, aYear] = a.split('/').map(Number);
    const [bDay, bMonth, bYear] = b.split('/').map(Number);
    const dateA = new Date(aYear, aMonth - 1, aDay);
    const dateB = new Date(bYear, bMonth - 1, bDay);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <FadeIn direction="up" duration={0.3}>
    <div className="min-h-screen bg-background">
      {/* Hero Section — title only, tight to the card below */}
      <div
        className="relative bg-black overflow-hidden cursor-pointer group"
        onClick={() => setShowLightbox(true)}
      >
        <div
          className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-700 group-hover:scale-110"
          style={{
            backgroundImage: `url(${event.images?.[0] || '/placeholder.jpg'})`,
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/30"></div>

        {/* Zoom indicator */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/70 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn className="h-3.5 w-3.5" />
          Ver imagem
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-4 pt-48 md:pt-64 lg:pt-80 pb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg max-w-4xl">
            {typeof event.title === 'string' ? event.title : 'Evento'}
          </h1>
        </div>
      </div>

      {/* Fullscreen Image Lightbox */}
      {showLightbox && event.images?.[0] && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setShowLightbox(false)}
          >
            <X className="h-6 w-6" />
          </button>
          <Image
            src={event.images[0]}
            alt={typeof event.title === 'string' ? event.title : 'Evento'}
            width={1200}
            height={800}
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
            unoptimized
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Quick Info Bar — floating summary strip */}
      <div className="container mx-auto px-4 -mt-5 relative z-10 mb-4">
        <div className="bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl shadow-lg px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="text-sm font-medium text-foreground">
                  {startDate.toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    timeZone: TZ,
                  })}
                  {isMultiDay && (
                    <>
                      {' — '}
                      {endDate.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        timeZone: TZ,
                      })}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="w-px h-8 bg-border/50 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Horário</p>
                <p className="text-sm font-medium text-foreground">
                  {startDate.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: TZ,
                  })}
                  {isMultiDay && (
                    <>
                      {' — '}
                      {endDate.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: TZ,
                      })}
                    </>
                  )}
                </p>
              </div>
            </div>
            {event.is_online ? (
              <>
                <div className="w-px h-8 bg-border/50 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Local</p>
                    <p className="text-sm font-medium text-green-400">
                      Online
                    </p>
                  </div>
                </div>
              </>
            ) : event.location ? (
              <>
                <div className="w-px h-8 bg-border/50 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Local</p>
                    <p className="text-sm font-medium text-foreground">
                      {event.location.title || event.location.city || 'A definir'}
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{Array.isArray(event.talks) ? event.talks.length : 0}</p>
              <p className="text-xs text-muted-foreground">Palestras</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{Array.isArray(event.communities) ? event.communities.length : 0}</p>
              <p className="text-xs text-muted-foreground">Comunidades</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">
                {(() => {
                  const diffMs = endDate.getTime() - startDate.getTime();
                  const diffHours = diffMs / (1000 * 60 * 60);
                  return diffHours.toFixed(0) + 'h';
                })()}
              </p>
              <p className="text-xs text-muted-foreground">Duração</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons — below the info card */}
      <div className="container mx-auto px-4 mb-8 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            variant="outline"
            className="rounded-full w-full"
            onClick={() => {
              track({
                eventType: 'share_click',
                eventDocumentId: event?.documentId,
                metadata: { route: `/events/${event?.slug || slugOrId}` },
              });
              if (
                typeof navigator !== 'undefined' &&
                typeof window !== 'undefined' &&
                'share' in navigator
              ) {
                navigator.share({
                  title: `Confira o evento ${
                    typeof event.title === 'string' ? event.title : 'Evento'
                  }\n`,
                  text: `\n${
                    typeof event?.description === 'string'
                      ? event.description
                      : 'Descrição não disponível'
                  }`,
                  url: window.location.href,
                });
              }
            }}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar
          </Button>
          {(() => {
            const eventHasPassed = new Date() > endDate;
            const certificateDisabled = isAuthenticated && !eventHasPassed;

            const handleCertificateClick = () => {
              if (certificateDisabled) return;
              if (!isAuthenticated) {
                router.push(`/?login=true&redirect=${encodeURIComponent(`/events/${event.slug || slugOrId}`)}`);
              } else {
                router.push(`/certificado?event=${event.documentId}`);
              }
            };

            return (
              <Button
                size="lg"
                variant="outline"
                className="rounded-full w-full"
                disabled={certificateDisabled}
                onClick={handleCertificateClick}
              >
                <Award className="h-4 w-4 mr-2" />
                <span className="sm:hidden">Certificado</span>
                <span className="hidden sm:inline">Solicitar certificado</span>
              </Button>
            );
          })()}
        </div>
        {isAlreadySignedUp ? (
          <div className="grid grid-cols-1 gap-3">
            <AddToCalendarButton
              title={event.title}
              description={event.description}
              startDate={event.start_date}
              endDate={event.end_date}
              location={
                event.location
                  ? event.location.full_address || event.location.title || event.location.city
                  : undefined
              }
              isOnline={event.is_online}
              callLink={callLink || event.call_link}
              variant="outline"
              size="lg"
              className="w-full"
            />
            <Button
              size="lg"
              className="rounded-full w-full font-semibold bg-green-600 hover:bg-green-700 text-white"
              onClick={() => router.push(`/events/${event?.slug || slugOrId}/signup`)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Já Inscrito — Ver Inscrição
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full w-full font-semibold border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => router.push(`/events/${event?.slug || slugOrId}/arte`)}
            >
              <ImagePlus className="h-4 w-4 mr-2" />
              Gerar minha arte &quot;me inscrevi&quot;
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            className="rounded-full w-full font-semibold"
            disabled={!hasInternalRegistration && !event.subscription_link}
            onClick={handleParticipate}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Participar do Evento
          </Button>
        )}
      </div>

      {/* Main Content — single-column flowing layout */}
      <div className="container mx-auto px-4 pb-16 space-y-12">

        {/* About Section */}
        {event?.description && (
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-5 flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              Sobre o Evento
            </h2>
            <div className="bg-card/50 border border-border/30 rounded-2xl p-5 sm:p-7 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/60 to-transparent rounded-l-2xl" />
              <div className="pl-4">
                <ExpandableRichText content={event?.description || ''} maxLines={15} />
              </div>
            </div>
          </section>
        )}

        {/* Location Section */}
        {event.location && (
          <>
            <div className="border-t border-border/40" />
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Localização
              </h2>
              <div className="bg-card/50 border border-border/30 rounded-2xl p-6 max-w-2xl">
                {event.location.title && (
                  <p className="font-semibold text-foreground text-lg mb-1">
                    {event.location.title}
                  </p>
                )}
                {event.location.full_address && (
                  <p className="text-muted-foreground text-sm mb-1">
                    {event.location.full_address}
                  </p>
                )}
                {event.location.city && (
                  <p className="text-muted-foreground text-sm mb-3">
                    {event.location.city}
                  </p>
                )}
                {event.location.google_maps_url && (
                  <a
                    href={event.location.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-primary text-primary hover:bg-primary/10"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Ver no Google Maps
                    </Button>
                  </a>
                )}
              </div>
            </section>
          </>
        )}

        {/* Schedule / Talks Section */}
        <div className="border-t border-border/40" />
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Programação
          </h2>
          {event.talks &&
          Array.isArray(event.talks) &&
          event.talks.length > 0 ? (
            sortedDateKeys.length > 0 ? (
              <div className="space-y-10">
                {sortedDateKeys.map(dateKey => {
                  const talksByTime = talksByDay[dateKey];
                  const sortedTimeKeys = Object.keys(talksByTime).sort(
                    (a, b) => {
                      const [aHour, aMin] = a.split(':').map(Number);
                      const [bHour, bMin] = b.split(':').map(Number);
                      return aHour * 60 + aMin - (bHour * 60 + bMin);
                    }
                  );

                  return (
                    <div key={dateKey} className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        {dateKey}
                      </h3>
                      <Tabs
                        defaultValue={sortedTimeKeys[0]}
                        className="w-full"
                      >
                        <TabsList className="flex w-full overflow-x-auto rounded-xl">
                          {sortedTimeKeys.map(timeKey => (
                            <TabsTrigger key={timeKey} value={timeKey} className="rounded-lg">
                              {timeKey}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {sortedTimeKeys.map(timeKey => (
                          <TabsContent
                            key={timeKey}
                            value={timeKey}
                            className="space-y-4 mt-6"
                          >
                            {talksByTime[timeKey]?.map((talk: any) => (
                              <TalkCard
                                key={talk.documentId}
                                talk={talk}
                                eventDocumentId={event.documentId}
                                eventSlug={event.slug}
                                agendaDocumentId={agenda?.documentId}
                                isInAgenda={isTalkInAgenda(
                                  talk.documentId
                                )}
                                onAgendaChange={handleAgendaChange}
                                onOptimisticUpdate={
                                  handleOptimisticUpdate
                                }
                                showAgendaActions={isAuthenticated}
                              />
                            ))}
                          </TabsContent>
                        ))}
                      </Tabs>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {event.talks.map((talk: any) => (
                  <TalkCard
                    key={talk.documentId}
                    talk={talk}
                    eventDocumentId={event.documentId}
                    eventSlug={event.slug}
                    agendaDocumentId={agenda?.documentId}
                    isInAgenda={isTalkInAgenda(talk.documentId)}
                    onAgendaChange={handleAgendaChange}
                    onOptimisticUpdate={handleOptimisticUpdate}
                    showAgendaActions={isAuthenticated}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="text-muted-foreground text-center py-10 bg-card/30 rounded-2xl border border-border/20">
              Programação ainda não divulgada.
            </div>
          )}
        </section>

        {/* Communities Section */}
        <div className="border-t border-border/40" />
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Comunidades Organizadoras
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {event.communities &&
            Array.isArray(event.communities) &&
            event.communities.length > 0 ? (
              event.communities.map((community: any) => (
                <Link
                  key={community.id}
                  href={`/communities/${community.slug || community.id}`}
                  className="group block"
                >
                  <div className="flex items-center gap-4 p-4 bg-card/50 border border-border/30 rounded-2xl hover:border-primary/30 hover:bg-card/80 hover:shadow-md transition-all duration-200">
                    {community.images?.[0] && (
                      <Image
                        src={community.images[0]}
                        alt={community.title}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-xl object-cover"
                        unoptimized
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {typeof community.title === 'string'
                          ? community.title
                          : 'Comunidade'}
                      </h4>
                      {community.short_description &&
                        typeof community.short_description ===
                          'string' && (
                        <p className="text-sm text-muted-foreground truncate">
                          {community.short_description}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8 col-span-full">
                Nenhuma comunidade organizadora listada.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Online Event Call Link for signed-up users */}
      {isAlreadySignedUp && event.is_online && callLink && (
        <div className="container mx-auto px-4 pb-8">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Evento Online</h3>
                <p className="text-sm text-muted-foreground">Acesse a chamada do evento</p>
              </div>
            </div>
            <a href={callLink} target="_blank" rel="noopener noreferrer">
              <Button className="rounded-full gap-2">
                <Video className="h-4 w-4" />
                Acessar
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
    </FadeIn>
  );
}
