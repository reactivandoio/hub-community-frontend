'use client';

import { useQuery } from '@apollo/client';
import {
  Calendar,
  ExternalLink,
  Instagram,
  Link2Icon,
  Linkedin,
  MapPin,
  MessageCircle,
  Share2,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { FadeIn } from '@/components/animations';
import { CommunityDetailsSkeleton } from '@/components/community-details-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExpandableRichText } from '@/components/ui/expandable-rich-text';
import { useAuth } from '@/contexts/auth-context';
import { useLoginPrompt } from '@/contexts/login-prompt-context';
import { GET_COMMUNITY_BY_SLUG_OR_ID, GET_EVENTS } from '@/lib/queries';
import { CommunityResponse, Event, EventsResponse } from '@/lib/types';

import {
  adjustToBrazilTimezone,
  getNextFutureEvents,
  getOngoingEvents,
  getPastEvents,
} from '../utils/event';

interface CommunityDetailsProps {
  slugOrId: string;
}

export function CommunityDetails({ slugOrId }: CommunityDetailsProps) {
  const { isAuthenticated } = useAuth();
  const { requestLogin } = useLoginPrompt();

  const { data, loading, error } = useQuery<CommunityResponse>(
    GET_COMMUNITY_BY_SLUG_OR_ID,
    {
      variables: { slugOrId },
    }
  );

  // Supplementary query to get full event data with images
  const { data: eventsData } = useQuery<EventsResponse>(GET_EVENTS);

  if (loading) {
    return <CommunityDetailsSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Erro ao carregar comunidade
          </h2>
          <p className="text-muted-foreground mb-4">
            Não foi possível carregar os detalhes da comunidade.
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

  const community = data?.communityBySlugOrId;

  if (!community) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Comunidade não encontrada
          </h2>
          <p className="text-muted-foreground">
            A comunidade que você está procurando não existe ou foi removida.
          </p>
        </div>
      </div>
    );
  }

  // Enrich community events with full data (images, location, talks) from the events query
  const allEvents = eventsData?.events?.data || [];
  const communityEventIds = new Set((community.events || []).map(e => e.id));
  const enrichedEvents = allEvents.filter(e => communityEventIds.has(e.id));
  // Fall back to community events if enriched data isn't available yet
  const eventsToUse = enrichedEvents.length > 0 ? enrichedEvents : (community.events || []);

  const pastEvents = getPastEvents(eventsToUse);
  const nextFutureEvents = getNextFutureEvents(eventsToUse);
  const ongoingEvents = getOngoingEvents(eventsToUse);

  const handleJoinClick = () => {
    if (!isAuthenticated) {
      // After the login the person is one click from the community link (a popup opened
      // without a click would be blocked).
      requestLogin({ reason: 'Entre para participar da comunidade' });
      return;
    }
    if (
      community.links &&
      community.links.length > 0 &&
      community.links[0].url &&
      typeof window !== 'undefined'
    ) {
      window.open(community.links[0].url, '_blank');
    }
  };

  const socialLinks = ['whatsapp', 'instagram', 'linkedin', 'web'].map(media => {
    const found = community.links?.find(
      link => link.name.toLowerCase() === media
    );
    let Icon;
    switch (media) {
      case 'whatsapp': Icon = MessageCircle; break;
      case 'instagram': Icon = Instagram; break;
      case 'linkedin': Icon = Linkedin; break;
      case 'web': Icon = ExternalLink; break;
      default: Icon = Link2Icon;
    }
    return found ? { media, url: found.url, Icon } : null;
  }).filter(Boolean);

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="relative min-h-64 md:min-h-80 lg:min-h-96 bg-black">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage: `url(${community.images?.[0]})`,
            }}
          ></div>
          <div className="absolute inset-0 bg-black/40"></div>

          <div className="relative container mx-auto px-4 h-full flex items-center py-8 md:py-12">
            <div className="text-white max-w-4xl">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                {community.title}
              </h1>
              <p className="text-base md:text-lg lg:text-xl mb-6 opacity-90">
                {community.short_description}
              </p>

              <div className="flex flex-wrap gap-4 md:gap-6 mb-6 text-sm md:text-base">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span>
                    {(community.members_quantity || 0).toLocaleString()} membros
                  </span>
                </div>
                {community.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    <span>{community.location}</span>
                  </div>
                )}
                {community.founded_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <span>Fundada em {community.founded_date}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-white/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 w-full sm:w-auto"
                  onClick={handleJoinClick}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Participar da comunidade
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-blue-600 bg-transparent w-full sm:w-auto"
                  onClick={() => {
                    if (
                      typeof navigator !== 'undefined' &&
                      typeof window !== 'undefined' &&
                      'share' in navigator
                    ) {
                      navigator.share({
                        title: `Confira a comunidade ${community.title}\n`,
                        text: `\n${community.short_description}`,
                        url: window.location.href,
                      });
                    }
                  }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12 space-y-16">

          {/* About */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Sobre</h2>
            <ExpandableRichText
              content={community.full_description || community.short_description}
              className="text-muted-foreground leading-relaxed mb-6 max-w-3xl"
            />
            <div className="flex flex-wrap gap-2">
              {community.tags.map(tag => (
                <Badge key={tag.id} variant="secondary">
                  {tag.value}
                </Badge>
              ))}
            </div>
          </section>

          {/* Social + Stats row */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Stats */}
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="text-3xl font-bold text-foreground">
                {(community.members_quantity || 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">membros</div>
            </div>
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="text-3xl font-bold text-foreground">
                {(community.events?.length || 0)}
              </div>
              <div className="text-sm text-muted-foreground">eventos realizados</div>
            </div>
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="text-3xl font-bold text-foreground">
                {nextFutureEvents?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">próximos eventos</div>
            </div>
            {/* Social Links */}
            <div className="p-5 rounded-xl border border-border bg-card">
              <div className="text-sm font-medium text-foreground mb-3">Redes Sociais</div>
              <div className="flex flex-wrap gap-3">
                {socialLinks.map(link => link && (
                  <a
                    key={link.media}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <link.Icon className="h-4 w-4" />
                    {link.media.charAt(0).toUpperCase() + link.media.slice(1)}
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* Organizers */}
          {community.organizers.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-6">Organizadores</h2>
              <div className="flex flex-wrap gap-4">
                {community.organizers.map(organizer => (
                  <Link
                    key={organizer.id}
                    href={`/users/${organizer.username}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {organizer.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">{organizer.username}</h4>
                      <p className="text-xs text-muted-foreground">{organizer.role || 'Organizador'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Ongoing Events */}
          {!!ongoingEvents?.length && (
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                Eventos em Andamento
              </h2>
              <EventCardGrid events={ongoingEvents} variant="ongoing" />
            </section>
          )}

          {/* Upcoming Events */}
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-6">Próximos Eventos</h2>
            {nextFutureEvents?.length ? (
              <EventCardGrid events={nextFutureEvents} />
            ) : (
              <p className="text-muted-foreground">
                Nenhum evento programado no momento.
              </p>
            )}
          </section>

          {/* Past Events */}
          {!!pastEvents?.length && (
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-6">Eventos Realizados</h2>
              <EventCardGrid events={pastEvents} variant="past" />
            </section>
          )}
        </div>
      </div>
    </FadeIn>
  );
}

/**
 * Reusable event card grid used within the community detail page.
 * Uses the same clean Meetup-style card design as the home page.
 */
function EventCardGrid({
  events,
  variant = 'default',
}: {
  events: Event[];
  variant?: 'default' | 'ongoing' | 'past';
}) {
  const borderClass =
    variant === 'ongoing'
      ? 'border-green-500/50 hover:border-green-500'
      : variant === 'past'
        ? 'border-border/60 hover:border-primary/30 opacity-80 hover:opacity-100'
        : 'border-border/60 hover:border-primary/30';

  const hoverTitleClass =
    variant === 'ongoing'
      ? 'group-hover:text-green-600'
      : 'group-hover:text-primary';

  const badgeEl =
    variant === 'ongoing' ? (
      <Badge className="absolute top-3 left-3 bg-green-600 text-white text-xs">
        Ao Vivo
      </Badge>
    ) : variant === 'past' ? (
      <Badge className="absolute top-3 left-3 bg-zinc-600 text-white text-xs">
        Finalizado
      </Badge>
    ) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {events.map((event: Event) => (
        <Link
          key={event.id}
          href={`/events/${event.slug || event.id}`}
          className="block group h-full"
        >
          <Card
            className={`overflow-hidden hover:shadow-lg transition-all duration-300 h-full flex flex-col ${borderClass}`}
          >
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
              {badgeEl}
            </div>
            <CardContent className="p-4 flex flex-col flex-1">
              <h3
                className={`font-bold text-foreground text-lg leading-snug mb-2 line-clamp-2 transition-colors ${hoverTitleClass}`}
              >
                {typeof event.title === 'string' ? event.title : 'Evento'}
              </h3>
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
              <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                <span>{'\u00A0'}</span>
                {event.talks?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {event.talks.length} palestra{event.talks.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
