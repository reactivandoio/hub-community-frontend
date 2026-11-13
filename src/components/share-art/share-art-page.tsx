'use client';

import { useQuery } from '@apollo/client';
import { ArrowLeft, Calendar, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { FadeIn } from '@/components/animations';
import { ShareArtGenerator } from '@/components/share-art/share-art-generator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useLoginPrompt } from '@/contexts/login-prompt-context';
import {
  GET_EVENT_BY_SLUG_OR_ID,
  GET_SHARE_ART_CONFIG,
  IS_USER_SIGNED_UP,
  MY_SHARE_ART_ROLE,
} from '@/lib/queries';
import type {
  ShareArtConfig,
  ShareArtPersonRole,
} from '@/lib/share-art-config';

function GeneratorSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-6">
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
      <div className="lg:col-span-6">
        <Skeleton className="mx-auto aspect-[9/16] w-full max-w-[360px] rounded-xl" />
      </div>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

/**
 * `/events/[id]/arte` — for a logged-in person signed up for the event. When the organizer opens the
 * art to everyone (`share_art_open`, REA-45), anyone with the link generates it, without a signup or
 * an account: the art is made in the browser and nothing is saved.
 */
export function ShareArtPage({ slugOrId }: { slugOrId: string }) {
  const { user, isAuthenticated, isHydrated } = useAuth();
  const { requestLogin } = useLoginPrompt();
  // The auth provider restores the session from localStorage in an effect; wait one commit so a
  // logged-in visitor does not see the "entre" notice flash.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const {
    data: eventData,
    loading: eventLoading,
    error: eventError,
  } = useQuery<{ eventBySlugOrId: any }>(GET_EVENT_BY_SLUG_OR_ID, {
    variables: { slugOrId },
  });
  const event = eventData?.eventBySlugOrId;
  const eventPath = `/events/${event?.slug || slugOrId}`;

  const { data: signupData, loading: signupLoading } = useQuery(
    IS_USER_SIGNED_UP,
    {
      variables: { eventId: slugOrId, email: user?.email || '' },
      skip: !isAuthenticated || !user?.email,
      fetchPolicy: 'network-only',
    }
  );
  const isSignedUp = Boolean(signupData?.isUserSignedUp?.is_signed_up);
  const artOpen = event?.share_art_open === true;
  const canGenerate = isSignedUp || artOpen;

  // REA-43: the event's custom art, when the organizer set one. Any failure → the default art.
  const { data: artData, loading: artLoading } = useQuery<{
    shareArtConfig: ShareArtConfig | null;
  }>(GET_SHARE_ART_CONFIG, {
    variables: { eventId: slugOrId },
    skip: !canGenerate,
    errorPolicy: 'all',
  });

  // REA-47: the person's role on the organizer's art (organizer, speaker or by the product of the
  // signup). Only asked when logged in; any failure → no role on the art.
  const { data: roleData, loading: roleLoading } = useQuery<{
    myShareArtRole: ShareArtPersonRole | null;
  }>(MY_SHARE_ART_ROLE, {
    variables: { eventId: slugOrId },
    skip: !canGenerate || !isAuthenticated,
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
  });
  const personRole = roleData?.myShareArtRole?.role ?? null;

  // Signed out: the login opens over this page once (REA-25); the notice keeps a button.
  const askLogin = () => requestLogin({ reason: 'Entre para gerar sua arte' });
  const needsLogin =
    !!isHydrated && !eventLoading && !!event && !isAuthenticated && !artOpen;
  const askedLogin = useRef(false);
  useEffect(() => {
    if (!needsLogin || askedLogin.current) return;
    askedLogin.current = true;
    askLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsLogin]);

  let content: ReactNode;
  if (
    !hydrated ||
    eventLoading ||
    (isAuthenticated && signupLoading) ||
    (canGenerate && (artLoading || (isAuthenticated && roleLoading)))
  ) {
    content = <GeneratorSkeleton />;
  } else if (eventError || !event) {
    content = (
      <Notice title="Evento não encontrado">
        <p className="text-muted-foreground">Confira o link e tente de novo.</p>
      </Notice>
    );
  } else if (canGenerate) {
    content = (
      <>
        {!isSignedUp && (
          <p
            className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground"
            data-testid="share-art-not-signed-up"
          >
            <span>
              Ainda não se inscreveu em <strong>{event.title}</strong>?
            </span>
            <Link href={eventPath} className="font-semibold text-primary underline-offset-4 hover:underline">
              Ver evento
            </Link>
          </p>
        )}
        <ShareArtGenerator
          event={event}
          defaultName={user?.name || ''}
          customConfig={artData?.shareArtConfig ?? null}
          signedUp={isSignedUp}
          personRole={personRole}
        />
      </>
    );
  } else if (!isAuthenticated) {
    content = (
      <Notice title="Entre para gerar sua arte">
        <p className="text-muted-foreground">
          A arte &quot;me inscrevi&quot; é para quem está inscrito em{' '}
          <strong>{event.title}</strong>.
        </p>
        <Button className="rounded-full" onClick={askLogin}>
          <LogIn className="mr-2 h-4 w-4" />
          Entrar
        </Button>
      </Notice>
    );
  } else {
    content = (
      <Notice title="Você ainda não está inscrito">
        <p className="text-muted-foreground">
          Inscreva-se em <strong>{event.title}</strong> para gerar sua arte.
        </p>
        <Link href={eventPath}>
          <Button className="rounded-full">
            <Calendar className="mr-2 h-4 w-4" />
            Ver evento
          </Button>
        </Link>
      </Notice>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <Link href={eventPath}>
            <Button variant="ghost" size="sm" className="-ml-2 mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao evento
            </Button>
          </Link>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">
              {artOpen && !isSignedUp
                ? 'Sua arte "eu vou"'
                : 'Sua arte "me inscrevi"'}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Escolha uma foto, o formato e o seu papel. Baixe ou compartilhe
              nos stories e no feed.
            </p>
          </div>
          {content}
        </div>
      </div>
    </FadeIn>
  );
}
