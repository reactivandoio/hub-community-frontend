'use client';

import { useQuery } from '@apollo/client';
import { Wallet } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/money';
import { EventPaymentRow, paymentStatusLabel, summarizePayments } from '@/lib/payment-status';
import { EVENT_PAYMENTS } from '@/lib/queries';

/**
 * Paid signups by payment state. Renders nothing for free events or when the
 * query is unavailable, so the analytics page never depends on it.
 */
export function EventPaymentsCard({ slugOrId }: { slugOrId: string }) {
  const { data } = useQuery<{ eventPayments: EventPaymentRow[] | null }>(EVENT_PAYMENTS, {
    variables: { slugOrId },
    skip: !slugOrId,
    fetchPolicy: 'network-only',
  });

  const rows = (data?.eventPayments || []).filter((r) => Number(r.value) > 0);
  if (rows.length === 0) return null;
  const summary = summarizePayments(rows);

  const items = [
    { label: paymentStatusLabel('CONFIRMED'), value: summary.paid },
    { label: paymentStatusLabel('PEDING_PAYMENT'), value: summary.pending },
    { label: paymentStatusLabel('EXPIRED'), value: summary.expired },
    { label: paymentStatusLabel('CANCELED'), value: summary.canceled },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Pagamentos
          <Badge variant="secondary" className="ml-auto font-normal">
            {formatCents(summary.revenueCents)} recebidos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="text-2xl font-bold">{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground mt-4">
          Pendentes seguram a vaga até pagar ou expirar. Expirados e cancelados não contam como
          inscritos e liberam a vaga.
        </p>
      </CardContent>
    </Card>
  );
}
