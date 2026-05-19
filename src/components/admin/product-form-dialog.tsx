'use client';

import { BatchFormDialog } from '@/components/admin/batch-form-dialog';
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
  productSchema,
  type ProductFormValues,
} from '@/lib/schemas';
import { Batch, Product } from '@/lib/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

// Extended definitions to match user request locally
interface ExtendedBatch extends Batch {
  id?: string;
  batch_number: number;
  value: number;
  half_price_eligible: boolean;
}

interface ExtendedProduct extends Product {
  id?: string;
  batches: ExtendedBatch[];
}

interface ProductFormDialogProps {
  onSave: (product: ExtendedProduct) => void;
  trigger?: React.ReactNode;
  initialData?: ExtendedProduct;
}

export function ProductFormDialog({
  onSave,
  trigger,
  initialData,
}: ProductFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<ExtendedBatch[]>(
    initialData?.batches || []
  );

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name || '',
      enabled: initialData?.enabled ?? true,
    },
  });

  useEffect(() => {
    if (open) {
      setBatches(initialData?.batches || []);
      form.reset({
        name: initialData?.name || '',
        enabled: initialData?.enabled ?? true,
      });
    }
  }, [open, initialData, form]);

  const handleAddBatch = (newBatch: ExtendedBatch) => {
    setBatches([...batches, newBatch]);
  };

  const handleRemoveBatch = (index: number) => {
    const newBatches = [...batches];
    newBatches.splice(index, 1);
    setBatches(newBatches);
  };

  const onSubmit = (data: ProductFormValues) => {
    onSave({
      id: initialData?.id || `new-prod-${Date.now()}`,
      ...data,
      batches: batches,
    });
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Adicionar Produto</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Produto' : 'Adicionar Novo Produto'}
          </DialogTitle>
          <DialogDescription>Defina o produto e seus lotes.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={e => {
              e.stopPropagation();
              form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Inscrição 1º Lote" {...field} />
                  </FormControl>
                  <FormMessage />
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
                    <FormLabel>Produto Ativo?</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">
                  Lotes (Batches)
                </FormLabel>
                <BatchFormDialog
                  onSave={handleAddBatch}
                  trigger={
                    <Button size="sm" variant="secondary" type="button">
                      <Plus className="w-3 h-3 mr-1" /> Novo Lote
                    </Button>
                  }
                />
              </div>

              {batches.length === 0 ? (
                <div className="text-sm text-center text-muted-foreground py-4">
                  Nenhum lote adicionado.
                </div>
              ) : (
                <div className="space-y-2">
                  {batches.map((batch, index) => {
                    const validUntilDate = batch.valid_until
                      ? new Date(batch.valid_until)
                      : null;
                    const validUntilStr =
                      validUntilDate && !isNaN(validUntilDate.getTime())
                        ? validUntilDate.toLocaleDateString('pt-BR')
                        : 'Não definido';

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-md bg-muted/20"
                      >
                        <div>
                          <div className="font-medium">
                            Lote {batch.batch_number} - R$ {batch.value}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Qtd: {batch.max_quantity || 'Ilimitado'} | Válido até:{' '}
                            {validUntilStr}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <BatchFormDialog
                            onSave={(updatedBatch) => {
                              const newBatches = [...batches];
                              newBatches[index] = updatedBatch;
                              setBatches(newBatches);
                            }}
                            initialData={batch}
                            trigger={
                              <Button
                                size="icon"
                                variant="ghost"
                                type="button"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            }
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            onClick={() => handleRemoveBatch(index)}
                          >
                            <Trash className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Salvar Produto</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
