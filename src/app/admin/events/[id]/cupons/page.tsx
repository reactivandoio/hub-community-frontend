'use client';

import { useQuery } from '@apollo/client';
import { useParams } from 'next/navigation';

import { useAdminAccess } from '@/components/admin/admin-guard';
import { AdminEmpty, AdminPage, AdminPageError, AdminPageHeader, AdminPageLoading } from '@/components/admin/admin-page';
import { CouponsTab } from '@/components/admin/coupons-tab';
import { FadeIn } from '@/components/animations';
import { usePaymentsV2 } from '@/hooks/use-payments-v2';
import { GET_EVENT_BY_SLUG_OR_ID } from '@/lib/queries';
import { EventResponse } from '@/lib/types';

// The coupons of one event (the "Cupons" tab of the event page before REA-24).
export default function EventCouponsPage() {
  const params = useParams();
  const id = params?.id as string;
  // Coupons are admin only on the BFF, and need the BFF with the payment API (REA-6).
  const { isAdmin } = useAdminAccess();
  const paymentsV2 = usePaymentsV2();
  const available = isAdmin && paymentsV2 === true;

  const { data, loading, error } = useQuery<EventResponse>(GET_EVENT_BY_SLUG_OR_ID, {
    variables: { slugOrId: id },
    skip: !id || !available,
  });
  const event = data?.eventBySlugOrId;

  if (isAdmin && (paymentsV2 === null || loading)) return <AdminPageLoading label="Carregando cupons" />;
  if (available && (error || !event)) {
    return <AdminPageError title="Não foi possível carregar o evento" message={error?.message} />;
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <AdminPage>
        <AdminPageHeader title="Cupons" description="Percentual ou valor fixo, com datas, limite de usos e lotes." />
        {!isAdmin ? (
          <AdminEmpty>Os cupons são gerenciados por um admin do Hub.</AdminEmpty>
        ) : !event ? (
          <AdminEmpty>Os cupons ainda não estão disponíveis neste servidor.</AdminEmpty>
        ) : (
          <div className="border rounded-lg p-6 bg-card">
            <CouponsTab eventId={event.id} eventSlug={event.slug || id} products={event.products || []} />
          </div>
        )}
      </AdminPage>
    </FadeIn>
  );
}
