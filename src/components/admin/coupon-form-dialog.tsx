'use client';

import { useMutation } from '@apollo/client';
import { Loader2, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  type CouponFormErrors,
  type CouponFormValues,
  couponFormErrors,
  couponFormToInput,
  couponToForm,
  isCouponLocked,
  normalizeCouponCode,
} from '@/lib/coupon';
import { CREATE_COUPON, UPDATE_COUPON } from '@/lib/queries';
import type { Coupon } from '@/lib/types';

export interface CouponBatchOption {
  id: string;
  label: string;
}

interface CouponFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  batches: CouponBatchOption[];
  /** Absent = new coupon. */
  coupon?: Coupon | null;
  onSaved: () => void;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-red-500">{message}</p> : null;
}

export function CouponFormDialog({
  open,
  onOpenChange,
  eventId,
  batches,
  coupon,
  onSaved,
}: CouponFormDialogProps) {
  const locked = isCouponLocked(coupon);
  const [values, setValues] = useState<CouponFormValues>(() => couponToForm(coupon));
  const [errors, setErrors] = useState<CouponFormErrors>({});
  const [serverError, setServerError] = useState('');

  const [createCoupon, { loading: creating }] = useMutation(CREATE_COUPON);
  const [updateCoupon, { loading: updating }] = useMutation(UPDATE_COUPON);
  const saving = creating || updating;

  useEffect(() => {
    if (open) {
      setValues(couponToForm(coupon));
      setErrors({});
      setServerError('');
    }
  }, [open, coupon]);

  const set = <K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleBatch = (id: string, checked: boolean) =>
    set(
      'batch_ids',
      checked ? [...values.batch_ids, id] : values.batch_ids.filter((b) => b !== id),
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = couponFormErrors(values, { locked });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setServerError('');
    const data = couponFormToInput(values, eventId, { locked });
    try {
      if (coupon?.id) {
        await updateCoupon({ variables: { id: coupon.id, data } });
      } else {
        await createCoupon({ variables: { data } });
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      // The Eventando owns the rules (code unique per event, type and value locked
      // after the first use): show its message as it comes.
      setServerError(err?.graphQLErrors?.[0]?.message || err?.message || 'Não foi possível salvar o cupom.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon?.id ? 'Editar cupom' : 'Novo cupom'}</DialogTitle>
          <DialogDescription>
            O cupom vale só para este evento. Na inscrição, vale o maior desconto entre o cupom e a
            meia-entrada, nunca os dois.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="coupon-code">Código</Label>
            <Input
              id="coupon-code"
              value={values.code}
              onChange={(e) => set('code', normalizeCouponCode(e.target.value))}
              placeholder="PROMO10"
              autoComplete="off"
            />
            <FieldError message={errors.code} />
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            {locked && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Este cupom já foi usado: tipo e valor não podem mais mudar.
              </p>
            )}
            <div className="space-y-2">
              <Label>Tipo de desconto</Label>
              <RadioGroup
                value={values.discount_type}
                onValueChange={(v) => set('discount_type', v as CouponFormValues['discount_type'])}
                className="flex gap-6"
                disabled={locked}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="percentage" id="coupon-type-percentage" />
                  <Label htmlFor="coupon-type-percentage" className="font-normal">
                    Percentual
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="fixed" id="coupon-type-fixed" />
                  <Label htmlFor="coupon-type-fixed" className="font-normal">
                    Valor fixo
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {values.discount_type === 'percentage' ? (
              <div className="space-y-2">
                <Label htmlFor="coupon-percentage">Desconto (%)</Label>
                <Input
                  id="coupon-percentage"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={values.discount_percentage}
                  onChange={(e) => set('discount_percentage', e.target.value)}
                  disabled={locked}
                />
                <FieldError message={errors.discount_percentage} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="coupon-fixed">Desconto (R$)</Label>
                <Input
                  id="coupon-fixed"
                  inputMode="decimal"
                  placeholder="10,00"
                  value={values.discount_reais}
                  onChange={(e) => set('discount_reais', e.target.value)}
                  disabled={locked}
                />
                <FieldError message={errors.discount_reais} />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-starts">Início</Label>
              <Input
                id="coupon-starts"
                type="datetime-local"
                value={values.starts_at}
                onChange={(e) => set('starts_at', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-expires">Fim</Label>
              <Input
                id="coupon-expires"
                type="datetime-local"
                value={values.expires_at}
                onChange={(e) => set('expires_at', e.target.value)}
              />
              <FieldError message={errors.expires_at} />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Sem datas, o cupom vale pelo período do lote.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coupon-max-uses">Limite de usos</Label>
            <Input
              id="coupon-max-uses"
              type="number"
              min={1}
              step={1}
              placeholder="Ilimitado"
              value={values.max_uses}
              onChange={(e) => set('max_uses', e.target.value)}
            />
            <FieldError message={errors.max_uses} />
            <p className="text-xs text-muted-foreground">
              Cada CPF usa no máximo um cupom por evento.
            </p>
          </div>

          {batches.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Lotes</legend>
              <p className="text-xs text-muted-foreground">Nenhum marcado = todos os lotes.</p>
              {batches.map((batch) => (
                <div key={batch.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`coupon-batch-${batch.id}`}
                    checked={values.batch_ids.includes(batch.id)}
                    onCheckedChange={(checked) => toggleBatch(batch.id, checked === true)}
                  />
                  <Label htmlFor={`coupon-batch-${batch.id}`} className="font-normal">
                    {batch.label}
                  </Label>
                </div>
              ))}
            </fieldset>
          )}

          <div className="flex items-center justify-between rounded-lg border p-4">
            <Label htmlFor="coupon-enabled">Ativo</Label>
            <Switch
              id="coupon-enabled"
              checked={values.enabled}
              onCheckedChange={(checked) => set('enabled', checked)}
            />
          </div>

          {serverError && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar cupom
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
