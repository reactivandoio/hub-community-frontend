'use client';

import { useQuery } from '@apollo/client';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { useAdminAccess } from '@/components/admin/admin-guard';
import { AdminPage, AdminPageError, AdminPageHeader, AdminPageLoading } from '@/components/admin/admin-page';
import { CampaignCard } from '@/components/admin/email-campaigns/campaign-card';
import { CampaignHistory } from '@/components/admin/email-campaigns/campaign-history';
import { FadeIn } from '@/components/animations';
import { campaignKinds, isActive } from '@/lib/email-campaign';
import { GET_EVENT_BY_SLUG_OR_ID, GET_EVENT_EMAIL_CAMPAIGNS } from '@/lib/queries';
import type { EmailCampaign, EventResponse } from '@/lib/types';

// While something is being sent, the history refreshes on its own.
const POLL_MS = 30_000;

// E-mail marketing do evento (REA-29): convite para a base (admin), "convide alguém" e lembrete.
export default function EventEmailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { isAdmin } = useAdminAccess();

  const event = useQuery<EventResponse>(GET_EVENT_BY_SLUG_OR_ID, { variables: { slugOrId: id }, skip: !id });
  const campaigns = useQuery<{ eventEmailCampaigns: EmailCampaign[] }>(GET_EVENT_EMAIL_CAMPAIGNS, {
    variables: { eventSlug: id },
    skip: !id,
    fetchPolicy: 'cache-and-network',
  });
  const list = campaigns.data?.eventEmailCampaigns ?? [];
  const anyActive = list.some((c) => c.status === 'sending');

  // Poll only while a campaign is sending.
  const { startPolling, stopPolling } = campaigns;
  useEffect(() => {
    if (anyActive) startPolling(POLL_MS);
    else stopPolling();
    return () => stopPolling();
  }, [anyActive, startPolling, stopPolling]);

  if ((event.loading && !event.data) || (campaigns.loading && !campaigns.data)) {
    return <AdminPageLoading label="Carregando e-mail marketing" />;
  }
  if (campaigns.error) {
    return <AdminPageError title="Não foi possível carregar as campanhas" message={campaigns.error.message} />;
  }

  const eventTitle = event.data?.eventBySlugOrId?.title;

  return (
    <FadeIn direction="up" duration={0.3}>
      <AdminPage>
        <AdminPageHeader
          title="E-mail marketing"
          description="E-mails com os dados do evento, enviados aos poucos dentro do limite diário. Todo e-mail tem link de descadastro."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {campaignKinds(isAdmin).map((kind) => (
            <CampaignCard
              key={kind.type}
              eventSlug={id}
              eventTitle={eventTitle}
              kind={kind}
              running={list.some((c) => c.type === kind.type && isActive(c))}
            />
          ))}
        </div>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Histórico</h2>
          <CampaignHistory eventSlug={id} campaigns={list} isAdmin={isAdmin} />
        </section>
      </AdminPage>
    </FadeIn>
  );
}
