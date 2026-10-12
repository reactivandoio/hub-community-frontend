'use client';

import { useQuery } from '@apollo/client';
import { useEffect } from 'react';

import { FadeIn } from '@/components/animations';
import { CommentForm } from '@/components/comment-form';
import { CommentsList } from '@/components/comments-list';
import { TalkDetailsSkeleton } from '@/components/talk-details-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ExpandableRichText } from '@/components/ui/expandable-rich-text';
import { useAuth } from '@/contexts/auth-context';
import { useLoginPrompt } from '@/contexts/login-prompt-context';
import { trackViewTalkDetail } from '@/lib/analytics';
import { GET_TALK_BY_ID } from '@/lib/queries';
import { TalkResponse } from '@/lib/types';
import { adjustToBrazilTimezone } from '@/utils/event';
import { useRef } from 'react';

interface TalkDetailsProps {
  talkId: string;
}

// Função para renderizar ícones das redes sociais
function getSocialIcon(socialMedia: string) {
  const iconClass = 'w-5 h-5';

  switch (socialMedia.toLowerCase()) {
    case 'twitter':
    case 'x':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case 'github':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.017 0C8.396 0 7.966.017 6.636.08c-1.33.063-2.24.286-3.037.611C2.812.996 2.05 1.733 1.447 2.636c-.325.797-.548 1.707-.611 3.037C.817 7.034.8 7.464.8 11.085c0 3.621.017 4.051.08 5.381.063 1.33.286 2.24.611 3.037.603.903 1.36 1.664 2.263 2.267.797.325 1.707.548 3.037.611 1.33.063 1.76.08 5.381.08s4.051-.017 5.381-.08c1.33-.063 2.24-.286 3.037-.611.903-.603 1.664-1.36 2.267-2.263.325-.797.548-1.707.611-3.037.063-1.33.08-1.76.08-5.381s-.017-4.051-.08-5.381c-.063-1.33-.286-2.24-.611-3.037-.603-.903-1.36-1.664-2.263-2.267C19.28.286 18.37.063 17.04.08c-1.33-.063-1.76-.08-5.381-.08zM12 2.163c3.439 0 3.845.014 5.204.077 1.236.057 1.896.27 2.334.448.583.236.999.547 1.435.983.436.436.747.852.983 1.435.178.438.391 1.098.448 2.334.063 1.359.077 1.765.077 5.204 0 3.439-.014 3.845-.077 5.204-.057 1.236-.27 1.896-.448 2.334-.236.583-.547.999-.983 1.435-.436.436-.852.747-1.435.983-.438.178-1.098.391-2.334.448-1.359.063-1.765.077-5.204.077-3.439 0-3.845-.014-5.204-.077-1.236-.057-1.896-.27-2.334-.448-.583-.236-.999-.547-1.435-.983-.436-.436-.747-.852-.983-1.435-.178-.438-.391-1.098-.448-2.334-.063-1.359-.077-1.765-.077-5.204 0-3.439.014-3.845.077-5.204.057-1.236.27-1.896.448-2.334.236-.583.547-.999.983-1.435.436-.436.852-.747 1.435-.983.438-.178 1.098-.391 2.334-.448 1.359-.063 1.765-.077 5.204-.077zm0 3.897a6.103 6.103 0 100 12.206 6.103 6.103 0 000-12.206zm0 10.041a3.938 3.938 0 110-7.876 3.938 3.938 0 010 7.876zm6.406-10.97a1.423 1.423 0 11-2.846 0 1.423 1.423 0 012.846 0z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M13.482 13.084c-.555.278-1.15.417-1.782.417-.632 0-1.227-.139-1.782-.417-.555-.278-.833-.694-.833-1.25 0-.556.278-.972.833-1.25.555-.278 1.15-.417 1.782-.417.632 0 1.227.139 1.782.417.555.278.833.694.833 1.25 0 .556-.278.972-.833 1.25z" />
          <path d="M13.5 7.5c0-.414-.168-.768-.504-1.062C12.66 6.144 12.336 6 12 6s-.66.144-1.004.438c-.336.294-.504.648-.504 1.062 0 .414.168.768.504 1.062.344.294.678.438 1.004.438s.66-.144 1.004-.438c.336-.294.504-.648.504-1.062z" />
          <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
        </svg>
      );
  }
}

export function TalkDetails({ talkId }: TalkDetailsProps) {
  const { data, loading, error } = useQuery<TalkResponse>(GET_TALK_BY_ID, {
    variables: { talkId },
  });
  const { isAuthenticated } = useAuth();
  const { requestLogin } = useLoginPrompt();
  const commentsRef = useRef<{ refetch: () => void } | null>(null);

  // Track talk detail view
  useEffect(() => {
    if (data?.talk) {
      trackViewTalkDetail(talkId, data.talk.event?.id);
    }
  }, [talkId, data?.talk]);

  if (loading) {
    return <TalkDetailsSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Erro ao carregar palestra
          </h2>
          <p className="text-muted-foreground mb-4">
            Não foi possível carregar os detalhes da palestra.
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

  const talk = data?.talk;

  if (!talk) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Palestra não encontrada
          </h2>
          <p className="text-muted-foreground">
            A palestra que você está procurando não existe ou foi removida.
          </p>
        </div>
      </div>
    );
  }

  const event = talk.event;
  const eventStartDate = adjustToBrazilTimezone(new Date(event.start_date));
  const eventEndDate = adjustToBrazilTimezone(new Date(event.end_date));

  return (
    <FadeIn direction="up" duration={0.3}>
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            {talk.highlight && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Destaque
              </span>
            )}
          </div>

          <h1 className="text-4xl font-bold text-foreground mb-4">
            {talk.title}
          </h1>

          {/* Local e Duração Section */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local */}
              {talk.room_description && (
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                      Local
                    </p>
                    <p className="text-sm font-medium text-blue-700">
                      {talk.room_description}
                    </p>
                  </div>
                </div>
              )}

              {/* Duração */}
              {talk.subtitle && (
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                      Duração
                    </p>
                    <p className="text-sm font-medium text-blue-700">
                      {talk.subtitle}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description Section */}
        {talk.description && (
          <div className="bg-card rounded-lg shadow-sm p-8 mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-6">
              Sobre a Palestra
            </h2>
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              {talk.description ? (
                <ExpandableRichText
                  content={talk.description}
                  className="text-muted-foreground leading-relaxed"
                />
              ) : (
                <div className="text-muted-foreground">
                  <p>Palestra sem descrição</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Speakers Section */}
        {talk.speakers && talk.speakers.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm p-8 mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-6">
              Palestrantes
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {talk.speakers.map(speaker => (
                <div
                  key={speaker.id}
                  className="flex flex-col items-center text-center p-6 bg-background rounded-lg"
                >
                  <Avatar className="w-24 h-24 mb-4">
                    <AvatarImage
                      src={speaker.avatar}
                      alt={speaker.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-lg font-semibold bg-blue-100 text-blue-800">
                      {speaker.name
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {speaker.name}
                  </h3>

                  {speaker.biography && (
                    <div className="text-muted-foreground text-sm leading-relaxed mb-4">
                      <ExpandableRichText
                        content={speaker.biography}
                        className="text-sm"
                      />
                    </div>
                  )}

                  {/* {speaker.socials && speaker.socials.length > 0 && (
                    <div className="flex gap-3 mt-auto">
                      {speaker.socials.map(social => (
                        <a
                          key={social.id}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title={social.social_media}
                        >
                          {getSocialIcon(social.social_media)}
                        </a>
                      ))}
                    </div>
                  )} */}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Information */}
        <div className="bg-card rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Informações do Evento
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {event.title}
              </h3>
              <div className="space-y-2 text-muted-foreground">
                <p>
                  <span className="font-medium">Data de início:</span>{' '}
                  {eventStartDate.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p>
                  <span className="font-medium">Data de fim:</span>{' '}
                  {eventEndDate.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {event.location && (
              <div>
                <h4 className="text-lg font-medium text-foreground mb-2">
                  Localização
                </h4>
                <div className="text-muted-foreground">
                  {event.location.title && (
                    <p className="font-medium">{event.location.title}</p>
                  )}
                  {event.location.full_address && (
                    <p>{event.location.full_address}</p>
                  )}
                  {event.location.city && <p>{event.location.city}</p>}
                  {event.location.google_maps_url && (
                    <a
                      href={event.location.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline mt-2 inline-block"
                    >
                      Ver no Google Maps
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-card rounded-lg shadow-sm p-8 mt-8">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            Comentários
          </h2>

          {/* Comments List */}
          <div className="mb-8">
            <CommentsList ref={commentsRef} talkId={talkId} />
          </div>

          {/* Comment Form - Only for authenticated users */}
          {isAuthenticated ? (
            <CommentForm
              talkId={talkId}
              refetchComments={() => commentsRef.current?.refetch()}
            />
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="text-blue-800 mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-blue-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <h3 className="text-lg font-medium mb-2">
                  Faça login para comentar
                </h3>
                <p className="text-sm">
                  Você precisa estar logado para deixar comentários nesta
                  palestra.
                </p>
              </div>
              <Button onClick={() => requestLogin({ reason: 'Entre para comentar nesta palestra' })}>
                Entrar para comentar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
    </FadeIn>
  );
}
