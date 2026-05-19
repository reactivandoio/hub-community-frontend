'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  votingOptionSchema,
  type VotingOptionFormValues,
} from '@/lib/schemas';
import { VotingOption } from '@/lib/types';

interface VotingOptionFormDialogProps {
  onSave: (option: any) => void;
  trigger?: React.ReactNode;
  initialData?: VotingOption;
  sessionId?: string;
  onSubmitSession?: () => Promise<string | undefined>;
}

export function VotingOptionFormDialog({
  onSave,
  trigger,
  initialData,
  sessionId,
  onSubmitSession,
}: VotingOptionFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<VotingOptionFormValues>({
    resolver: zodResolver(votingOptionSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      pitch_order: initialData?.pitch_order || 1,
    },
  });

  const onSubmit = async (data: VotingOptionFormValues) => {
    try {
      setSaving(true);
      let currentSessionId = sessionId;

      if (!currentSessionId && onSubmitSession) {
        toast({
          title: 'Salvando sessão...',
          description: 'A sessão precisa ser salva antes de adicionar opções.',
        });
        currentSessionId = await onSubmitSession();
      }

      if (!currentSessionId) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível obter o ID da sessão.',
        });
        setSaving(false);
        return;
      }

      const optionInput = {
        name: data.name,
        description: data.description || '',
        pitch_order: data.pitch_order,
        voting_session: currentSessionId,
      };

      if (initialData?.documentId) {
        // Update existing option
        const res = await fetch(`https://manager.hubcommunity.io/api/voting-options/${initialData.documentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: optionInput }),
        });

        if (!res.ok) throw new Error('Falha ao atualizar opção.');
        const resData = await res.json();
        
        onSave(resData.data);
        toast({
          title: 'Opção atualizada',
          description: 'A opção de voto foi atualizada.',
        });
      } else {
        // Create new option
        const res = await fetch('https://manager.hubcommunity.io/api/voting-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: optionInput }),
        });

        if (!res.ok) throw new Error('Falha ao criar opção.');
        const resData = await res.json();
        
        onSave(resData.data);
        toast({
          title: 'Opção adicionada',
          description: 'A opção de voto foi adicionada com sucesso.',
        });
      }

      setOpen(false);
      form.reset();
    } catch (err) {
      console.error('Error saving voting option:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar opção',
        description: 'Não foi possível salvar a opção de voto.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Adicionar Opção</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Opção de Voto' : 'Adicionar Opção de Voto'}
          </DialogTitle>
          <DialogDescription>
            Detalhes do pitch ou opção a ser votada.
          </DialogDescription>
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
                  <FormLabel>Nome (Ex: StrategyHub)</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da opção" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Breve descrição do pitch" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pitch_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordem de Apresentação</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
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
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Opção'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
