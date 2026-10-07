'use client';

import { useQuery } from '@apollo/client';
import { ArrowLeft, Calendar, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { FadeIn } from '@/components/animations';
import { ShareArtGenerator } from '@/components/share-art/share-art-generator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { GET_EVENT_BY_SLUG_OR_ID, IS_USER_SIGNED_UP } from '@/lib/queries';

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

/** `/events/[id]/arte` — only for a logged-in person signed up for the event. */
export function ShareArtPage({ slugOrId }: { slugOrId: string }) {
  const { user, isAuthenticated } = useAuth();
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

  let content: ReactNode;
  if (!hydrated || eventLoading || (isAuthenticated && signupLoading)) {
    content = <GeneratorSkeleton />;
  } else if (eventError || !event) {
    content = (
      <Notice title="Evento não encontrado">
        <p className="text-muted-foreground">Confira o link e tente de novo.</p>
      </Notice>
    );
  } else if (!isAuthenticated) {
    content = (
      <Notice title="Entre para gerar sua arte">
        <p className="text-muted-foreground">
          A arte &quot;me inscrevi&quot; é para quem está inscrito em{' '}
          <strong>{event.title}</strong>.
        </p>
        <Link
          href={`/?login=true&redirect=${encodeURIComponent(`${eventPath}/arte`)}`}
        >
          <Button className="rounded-full">
            <LogIn className="mr-2 h-4 w-4" />
            Entrar
          </Button>
        </Link>
      </Notice>
    );
  } else if (!isSignedUp) {
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
  } else {
    content = (
      <ShareArtGenerator event={event} defaultName={user?.name || ''} />
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
              Sua arte &quot;me inscrevi&quot;
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
