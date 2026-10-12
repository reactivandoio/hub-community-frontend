'use client';

import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { Check, Copy, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { type CouponBatchOption, CouponFormDialog } from '@/components/admin/coupon-form-dialog';
import { Badge } from '@/components/ui/badge';
import { AdminPageActions } from '@/components/admin/page-actions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { couponUsesLabel, couponValueLabel } from '@/lib/coupon';
import { couponLink } from '@/lib/coupon-link';
import { EVENT_COUPONS } from '@/lib/queries';
import type { Coupon, Product } from '@/lib/types';

interface CouponsTabProps {
  eventId: string;
  /** Slug of the public event page, for the ready-made coupon link. */
  eventSlug: string;
  products: Product[];
}

const day = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm');

function windowLabel(coupon: Coupon): string {
  if (!coupon.starts_at && !coupon.expires_at) return 'Período do lote';
  if (coupon.starts_at && coupon.expires_at) return `${day(coupon.starts_at)} a ${day(coupon.expires_at)}`;
  if (coupon.starts_at) return `A partir de ${day(coupon.starts_at)}`;
  return `Até ${day(coupon.expires_at as string)}`;
}

/** Admin "Cupons" tab of an event (REA-6): list, create and edit. */
export function CouponsTab({ eventId, eventSlug, products }: CouponsTabProps) {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useQuery<{ eventCoupons: Coupon[] }>(EVENT_COUPONS, {
    variables: { eventId },
    fetchPolicy: 'network-only',
  });
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  // REA-18: public event URL with the code in the fragment (#cupom=CODE).
  const linkFor = (code: string) => couponLink(window.location.origin, eventSlug, code);

  const copyLink = async (code: string) => {
    const url = linkFor(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      setTimeout(() => setCopied((current) => (current === code ? null : current)), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar', description: url });
    }
  };

  const batchOptions: CouponBatchOption[] = useMemo(
    () =>
      products.flatMap((p) =>
        (p.batches || [])
          .filter((b) => b.id)
          .map((b) => ({ id: String(b.id), label: `${p.name} — Lote ${b.batch_number}` })),
      ),
    [products],
  );
  const batchLabel = useMemo(
    () => new Map(batchOptions.map((b) => [b.id, b.label])),
    [batchOptions],
  );

  const coupons = data?.eventCoupons || [];

  const openDialog = (coupon: Coupon | null) => {
    setEditing(coupon);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Title and description come from the page header; the action goes to the top bar. */}
      <AdminPageActions>
        <Button size="sm" onClick={() => openDialog(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cupom
        </Button>
      </AdminPageActions>

      {justCreated && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
        >
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">
              Cupom <span className="font-mono">{justCreated}</span> criado. Quem abrir este link chega à
              inscrição com o cupom aplicado:
            </p>
            <p className="break-all font-mono text-xs text-muted-foreground">{linkFor(justCreated)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => copyLink(justCreated)}>
            {copied === justCreated ? (
              <Check className="mr-2 h-4 w-4 text-green-600" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied === justCreated ? 'Link copiado' : 'Copiar link'}
          </Button>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-red-500">
          Não foi possível carregar os cupons: {error.message}
        </p>
      ) : loading && !data ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 w-full rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cupom neste evento.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Lotes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sr-only">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono font-medium">{coupon.code}</TableCell>
                  <TableCell>{couponValueLabel(coupon)}</TableCell>
                  <TableCell className="text-xs">{windowLabel(coupon)}</TableCell>
                  <TableCell>{couponUsesLabel(coupon)}</TableCell>
                  <TableCell className="text-xs">
                    {coupon.batches && coupon.batches.length > 0
                      ? coupon.batches
                          .map((b) => batchLabel.get(String(b.id)) || `Lote ${b.batch_number ?? b.id}`)
                          .join(', ')
                      : 'Todos'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={coupon.enabled === false ? 'secondary' : 'default'}>
                      {coupon.enabled === false ? 'Inativo' : 'Ativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLink(coupon.code)}
                      aria-label={`Copiar link do cupom ${coupon.code}`}
                    >
                      {copied === coupon.code ? (
                        <Check className="mr-2 h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      {copied === coupon.code ? 'Link copiado' : 'Copiar link'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDialog(coupon)}
                      aria-label={`Editar cupom ${coupon.code}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CouponFormDialog
        open={open}
        onOpenChange={setOpen}
        eventId={eventId}
        batches={batchOptions}
        coupon={editing}
        onSaved={(created) => {
          setJustCreated(created ?? null);
          refetch();
        }}
      />
    </div>
  );
}
