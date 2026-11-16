'use client';

import { useQuery } from '@apollo/client';

import { AdminPage, AdminPageError, AdminPageHeader, AdminPageLoading } from '@/components/admin/admin-page';
import { EmailQueueView } from '@/components/admin/email-queue/email-queue-view';
import { FadeIn } from '@/components/animations';
import { ADMIN_EMAIL_QUEUE } from '@/lib/queries';
import type { AdminEmailQueue } from '@/lib/types';

/** REA-59: every e-mail still scheduled, admin only (ADMIN_ONLY_PATHS; the BFF checks it too). */
export default function AdminEmailQueuePage() {
  const { data, loading, error, refetch } = useQuery<{ adminEmailQueue: AdminEmailQueue }>(ADMIN_EMAIL_QUEUE, {
    fetchPolicy: 'network-only',
    pollInterval: 60_000,
  });
  const queue = data?.adminEmailQueue;
  if (loading && !queue) return <AdminPageLoading label="Carregando e-mails agendados" />;
  if (error && !queue) return <AdminPageError message={error.message} />;
  if (!queue) return null;
  return (
    <FadeIn>
      <AdminPage>
        <AdminPageHeader
          title="E-mails agendados"
          description="Campanhas na fila de todos os eventos, previsão de envio e uso do dia e do mês."
        />
        <EmailQueueView queue={queue} onChanged={() => { refetch().catch(() => undefined); }} />
      </AdminPage>
    </FadeIn>
  );
}
