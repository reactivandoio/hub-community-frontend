'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AdminPage, AdminPageHeader, AdminPageLoading } from '@/components/admin/admin-page';
import { FadeIn } from '@/components/animations';
import { CertificateConfigForm } from '@/components/admin/certificate-config-form';
import { CertificateIssueTable } from '@/components/admin/certificate-issue-table';
import { CertificateRequestForms } from '@/components/admin/certificate-request-forms';
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
    return <AdminPageLoading label="Carregando certificados" />;
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <AdminPage>
        <AdminPageHeader
          title="Certificados"
          description="Modelo do certificado, formulários de solicitação e emissão."
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="modelo">Modelo</TabsTrigger>
            <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
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
          <TabsContent value="solicitacoes" forceMount className="data-[state=inactive]:hidden">
            <CertificateRequestForms eventId={eventId} />
          </TabsContent>
          <TabsContent value="emissao" forceMount className="data-[state=inactive]:hidden">
            <CertificateIssueTable eventId={eventId} eventSlug={event.slug || eventId} />
          </TabsContent>
        </Tabs>
      </AdminPage>
    </FadeIn>
  );
}
