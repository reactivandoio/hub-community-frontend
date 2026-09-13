'use client';

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
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useToast } from '@/hooks/use-toast';
import { CREATE_SPEAKER, GET_SPEAKERS } from '@/lib/queries';
import {
  speakerSchema,
  type SpeakerFormValues,
} from '@/lib/schemas';
import { CreateSpeakerResponse, Speaker } from '@/lib/types';
import { useMutation } from '@apollo/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

interface SpeakerFormDialogProps {
  onSave: (speaker: Speaker) => void;
  trigger?: React.ReactNode;
}

export function SpeakerFormDialog({ onSave, trigger }: SpeakerFormDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [createSpeaker, { loading }] = useMutation<CreateSpeakerResponse>(
    CREATE_SPEAKER,
    {
      refetchQueries: [{ query: GET_SPEAKERS }],
    }
  );

  const form = useForm<SpeakerFormValues>({
    resolver: zodResolver(speakerSchema),
    defaultValues: {
      name: '',
      biography: [],
    },
  });

  const onSubmit = async (data: SpeakerFormValues) => {
    try {
      const { data: responseData } = await createSpeaker({
        variables: {
          data: {
            name: data.name,
            biography: data.biography,
          },
        },
      });

      if (responseData?.createSpeaker) {
        onSave(responseData.createSpeaker as any);
        setOpen(false);
        form.reset();
        toast({
          title: 'Palestrante criado',
          description: 'O palestrante foi criado com sucesso.',
        });
      }
    } catch (err) {
      console.error('Error creating speaker:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar palestrante',
        description: 'Não foi possível criar o palestrante.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Adicionar Palestrante</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Palestrante</DialogTitle>
          <DialogDescription>Insira os dados do palestrante.</DialogDescription>
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
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="biography"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biografia</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={Array.isArray(field.value) ? field.value : []}
                      onChange={field.onChange}
                      placeholder="Biografia do palestrante..."
                    />
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
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
