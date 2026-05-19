'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  batchSchema,
  type BatchFormValues,
} from '@/lib/schemas';
import { Batch } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

// Extending Batch type to match user request locally if needed, or assuming updated types
interface ExtendedBatch extends Batch {
  id?: string;
  batch_number: number;
  value: number;
  half_price_eligible: boolean;
}

interface BatchFormDialogProps {
  onSave: (batch: ExtendedBatch) => void;
  trigger?: React.ReactNode;
  initialData?: ExtendedBatch;
}

export function BatchFormDialog({
  onSave,
  trigger,
  initialData,
}: BatchFormDialogProps) {
  const [open, setOpen] = useState(false);

  const formatDateTimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return format(new Date(isoString), "yyyy-MM-dd'T'HH:mm");
    } catch {
      return '';
    }
  };

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      batch_number: initialData?.batch_number || 1,
      value: initialData?.value || 0,
      max_quantity: initialData?.max_quantity,
      valid_from: formatDateTimeLocal(initialData?.valid_from),
      valid_until: formatDateTimeLocal(initialData?.valid_until),
      enabled: initialData?.enabled ?? true,
      half_price_eligible: initialData?.half_price_eligible ?? false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        batch_number: initialData?.batch_number || 1,
        value: initialData?.value || 0,
        max_quantity: initialData?.max_quantity,
        valid_from: formatDateTimeLocal(initialData?.valid_from),
        valid_until: formatDateTimeLocal(initialData?.valid_until),
        enabled: initialData?.enabled ?? true,
        half_price_eligible: initialData?.half_price_eligible ?? false,
      });
    }
  }, [open, initialData, form]);

  const onSubmit = (data: BatchFormValues) => {
    onSave({
      id: initialData?.id || `new-batch-${Date.now()}`,
      ...data,
      valid_from: data.valid_from ? new Date(data.valid_from).toISOString() : '',
      valid_until: data.valid_until ? new Date(data.valid_until).toISOString() : '',
      // Ensure max_quantity is number or undefined
      max_quantity: data.max_quantity || 0,
    });
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Adicionar Lote</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Lote' : 'Adicionar Novo Lote'}
          </DialogTitle>
          <DialogDescription>Configure as regras do lote.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={e => {
              e.stopPropagation();
              form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="batch_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do Lote</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="max_quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade Máxima</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Válido De</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Válido Até</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="half_price_eligible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Elegível a Meia Entrada?</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Ativo?</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
