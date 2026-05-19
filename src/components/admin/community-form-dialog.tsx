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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CREATE_COMMUNITY, GET_COMMUNITIES } from '@/lib/queries';
import {
  createCommunitySchema,
  generateSlugFromTitle,
  type CreateCommunityFormValues,
} from '@/lib/schemas';
import { CreateCommunityResponse } from '@/lib/types';
import { useMutation } from '@apollo/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

interface CommunityFormDialogProps {
  onSave: (community: CreateCommunityResponse['createCommunity']) => void;
  trigger?: React.ReactNode;
}

export function CommunityFormDialog({
  onSave,
  trigger,
}: CommunityFormDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [createCommunity, { loading }] = useMutation<CreateCommunityResponse>(
    CREATE_COMMUNITY,
    {
      refetchQueries: [{ query: GET_COMMUNITIES }],
    }
  );

  const form = useForm<CreateCommunityFormValues>({
    resolver: zodResolver(createCommunitySchema),
    defaultValues: {
      title: '',
      slug: '',
      short_description: '',
    },
  });

  const generateSlug = () => {
    const title = form.getValues('title');
    form.setValue('slug', generateSlugFromTitle(title));
  };

  const onSubmit = async (data: CreateCommunityFormValues) => {
    try {
      const { data: responseData } = await createCommunity({
        variables: {
          data: {
            title: data.title,
            slug: data.slug,
            short_description: data.short_description,
          },
        },
      });

      if (responseData?.createCommunity) {
        onSave(responseData.createCommunity);
        setOpen(false);
        form.reset();
        toast({
          title: 'Comunidade criada',
          description: 'A comunidade foi criada com sucesso.',
        });
      }
    } catch (error) {
      console.error('Error creating community:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar comunidade',
        description: 'Não foi possível criar a comunidade.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Adicionar Comunidade</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Nova Comunidade</DialogTitle>
          <DialogDescription>
            Crie uma nova comunidade para vincular ao evento.
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Comunidade</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: React Brasil"
                      {...field}
                      onChange={e => {
                        field.onChange(e);
                        // Optional: auto-generate slug
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="react-brasil" {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateSlug}
                    >
                      Gerar
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="short_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Curta</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Uma breve descrição..." {...field} />
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
