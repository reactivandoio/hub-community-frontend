'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { FadeIn } from '@/components/animations';
import { CertificateConfigForm } from '@/components/admin/certificate-config-form';
import { CertificateIssueTable } from '@/components/admin/certificate-issue-table';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GET_CERTIFICATE_CONFIG, GET_EVENT_BY_SLUG_OR_ID } from '@/lib/queries';
import type { CertificateConfig, CertificateConfigResponse, EventResponse } from '@/lib/types';

export default function CertificadosAdminPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [tab, setTab] = useState('modelo');

  const { data: eventData, loading: eventLoading } = useQuery<EventResponse>(GET_EVENT_BY_SLUG_OR_ID, {
    variables: { slugOrId: id },
    skip: !id,
  });
  const event = eventData?.eventBySlugOrId;
  const eventId = event?.documentId || event?.id;

  const { data: configData, loading: configLoading, refetch } = useQuery<CertificateConfigResponse>(GET_CERTIFICATE_CONFIG, {
    variables: { eventId },
    skip: !eventId,
    fetchPolicy: 'network-only',
  });
  const [config, setConfig] = useState<CertificateConfig | null | undefined>(undefined);
  const effectiveConfig = config === undefined ? configData?.certificateConfig : config;

  if (eventLoading || configLoading || !event || !eventId) {
    return (
      <div className="container mx-auto py-10 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto py-10 px-4 max-w-7xl">
        <div className="flex items-center space-x-4 mb-8">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Certificados</h1>
            <p className="text-muted-foreground mt-1">{event.title}</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="modelo">Modelo</TabsTrigger>
            <TabsTrigger value="emissao">Emissão</TabsTrigger>
          </TabsList>
          <TabsContent value="modelo" forceMount className="data-[state=inactive]:hidden">
            <CertificateConfigForm
              eventId={eventId}
              event={event}
              initialConfig={effectiveConfig}
              onSaved={(saved) => {
                setConfig(saved);
                refetch();
              }}
            />
          </TabsContent>
          <TabsContent value="emissao" forceMount className="data-[state=inactive]:hidden">
            <CertificateIssueTable eventId={eventId} eventSlug={event.slug || eventId} />
          </TabsContent>
        </Tabs>
      </div>
    </FadeIn>
  );
}
