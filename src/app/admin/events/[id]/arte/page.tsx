'use client';

import { useQuery } from '@apollo/client';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  AdminPage,
  AdminPageError,
  AdminPageHeader,
  AdminPageLoading,
} from '@/components/admin/admin-page';
import { ShareArtConfigForm } from '@/components/admin/share-art-config-form';
import { FadeIn } from '@/components/animations';
import { GET_EVENT_BY_SLUG_OR_ID, GET_SHARE_ART_CONFIG } from '@/lib/queries';
import type { ShareArtConfig } from '@/lib/share-art-config';
import type { EventResponse } from '@/lib/types';

/**
 * `/admin/events/<id>/arte` (REA-43): background and photo area of the "eu vou" art per format.
 * Admin and organizer of the event; the BFF checks it again on save.
 */
export default function ShareArtAdminPage() {
  const params = useParams();
  const id = params?.id as string;

  const {
    data: eventData,
    loading: eventLoading,
    error: eventError,
  } = useQuery<EventResponse>(GET_EVENT_BY_SLUG_OR_ID, {
    variables: { slugOrId: id },
    skip: !id,
  });
  const event = eventData?.eventBySlugOrId;
  const eventId = event?.documentId || event?.id;

  const { data, loading, error } = useQuery<{
    shareArtConfig: ShareArtConfig | null;
  }>(GET_SHARE_ART_CONFIG, {
    variables: { eventId },
    skip: !eventId,
    fetchPolicy: 'network-only',
  });
  // After a save the form gets what the BFF returned, without waiting for a refetch.
  const [savedConfig, setSavedConfig] = useState<
    ShareArtConfig | null | undefined
  >(undefined);
  const config = savedConfig === undefined ? data?.shareArtConfig : savedConfig;

  if (eventError || error) {
    return (
      <AdminPageError message="Não foi possível carregar a arte do evento." />
    );
  }
  if (eventLoading || loading || !event || !eventId) {
    return <AdminPageLoading label="Carregando a arte do evento" />;
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <AdminPage>
        <AdminPageHeader
          title='Arte "Eu vou"'
          description="A arte que cada participante gera com a própria foto. Escolha o fundo de cada formato e marque onde a foto aparece."
        />
        <ShareArtConfigForm
          eventId={eventId}
          initialConfig={config}
          onSaved={setSavedConfig}
        />
      </AdminPage>
    </FadeIn>
  );
}
