'use client';

import { useQuery } from '@apollo/client';
import { useParams } from 'next/navigation';

import { useAdminAccess } from '@/components/admin/admin-guard';
import { CouponsTab } from '@/components/admin/coupons-tab';
import { FadeIn } from '@/components/animations';
import { Skeleton } from '@/components/ui/skeleton';
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

  let content: React.ReactNode;
  if (!isAdmin) {
    content = <p className="text-sm text-muted-foreground">Os cupons são gerenciados por um admin do Hub.</p>;
  } else if (paymentsV2 === false) {
    content = <p className="text-sm text-muted-foreground">Os cupons ainda não estão disponíveis neste servidor.</p>;
  } else if (paymentsV2 === null || loading) {
    content = (
      <div className="space-y-3" role="status" aria-label="Carregando cupons">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  } else if (error || !event) {
    content = <p className="text-sm text-red-500">Não foi possível carregar o evento.</p>;
  } else {
    content = <CouponsTab eventId={event.id} eventSlug={event.slug || id} products={event.products || []} />;
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto py-10 px-4 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Cupons</h1>
          <p className="text-muted-foreground mt-2">Descontos do evento e o link pronto de cada cupom.</p>
        </div>
        <div className="border rounded-lg p-6 bg-card">{content}</div>
      </div>
    </FadeIn>
  );
}
