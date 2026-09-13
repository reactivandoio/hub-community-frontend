'use client';

import { useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GET_EVENTS } from '@/lib/queries';
import {
  votingSessionSchema,
  type VotingSessionFormValues,
} from '@/lib/schemas';
import { VotingOption, VotingSessionInput } from '@/lib/types';
import { VotingOptionFormDialog } from '@/components/admin/voting-option-form-dialog';
import { useToast } from '@/hooks/use-toast';

export interface VotingSessionFormProps {
  initialData?: VotingSessionFormValues & {
    documentId?: string;
    voting_options?: VotingOption[];
  };
  onSubmit: (data: VotingSessionFormValues) => Promise<string | undefined>;
  isLoading?: boolean;
}

export function VotingSessionForm({
  initialData,
  onSubmit,
  isLoading,
}: VotingSessionFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [options, setOptions] = useState<VotingOption[]>(
    initialData?.voting_options || []
  );
  
  // Events State for Combobox
  const [events, setEvents] = useState<{ label: string; value: string }[]>([]);
  const { data: eventsData } = useQuery(GET_EVENTS, {
    variables: { sort: [{ start_date: 'DESC' }] },
  });

  const form = useForm<VotingSessionFormValues>({
    resolver: zodResolver(votingSessionSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      event_id: initialData?.event_id || '',
      status: initialData?.status || 'open',
      max_votes_per_user: initialData?.max_votes_per_user || 1,
    },
  });

  useEffect(() => {
    if (eventsData?.events?.data) {
      const formattedOptions = eventsData.events.data.map((evt: any) => ({
        label: evt.title,
        value: evt.documentId || evt.id,
      }));
      setEvents(formattedOptions);
    }
  }, [eventsData]);

  const handleEventSelect = (id: string) => {
    form.setValue('event_id', id);
  };

  const handleAddOption = (newOption: VotingOption) => {
    // If it's an update, replace the existing one, else append
    const existingIndex = options.findIndex((o) => o.documentId === newOption.documentId);
    if (existingIndex >= 0) {
      const updated = [...options];
      updated[existingIndex] = newOption;
      setOptions(updated);
    } else {
      setOptions((prev) => [...prev, newOption].sort((a, b) => a.pitch_order - b.pitch_order));
    }
  };

  const handleDeleteOption = async (documentId: string) => {
    if (!confirm('Tem certeza que deseja remover esta opção?')) return;
    try {
      const res = await fetch(`https://manager.hubcommunity.io/api/voting-options/${documentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao excluir a opção.');
      
      setOptions(options.filter(o => o.documentId !== documentId));
      toast({
        title: 'Opção removida',
        description: 'A opção de voto foi removida com sucesso.',
      });
    } catch (err: any) {
       toast({
        variant: 'destructive',
        title: 'Erro',
        description: err.message || 'Falha ao remover a opção.',
      });
    }
  };

  const handleSaveSessionData = async (): Promise<string | undefined> => {
    const isValid = await form.trigger();
    if (isValid) {
      return await onSubmit(form.getValues());
    }
    return undefined;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="options">Opções de Voto</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da Sessão</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Batalha de Pitchs" {...field} />
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
                    <Textarea placeholder="Detalhes sobre a votação..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="event_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col pt-2">
                    <FormLabel className="mb-2 text-sm font-medium">Evento Relacionado</FormLabel>
                    <Combobox
                      options={events}
                      value={field.value}
                      onSelect={handleEventSelect}
                      placeholder="Selecione um evento..."
                    />
                    <FormDescription>
                      A qual evento esta votação pertence (opcional).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">Aberta</SelectItem>
                        <SelectItem value="closed">Fechada</SelectItem>
                        <SelectItem value="archived">Arquivada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_votes_per_user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máximo de Votos por Usuário</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormDescription>
                      Quantos pitchs diferentes um usuário pode votar.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="options" className="space-y-6 mt-6">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <FormLabel className="text-base font-semibold">Opções de Voto (Pitchs)</FormLabel>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione as startups ou opções que irão receber os votos.
                  </p>
                </div>
                <VotingOptionFormDialog
                  onSave={handleAddOption}
                  sessionId={initialData?.documentId}
                  onSubmitSession={handleSaveSessionData}
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Opção
                    </Button>
                  }
                />
              </div>

              {options.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
                  Nenhuma opção cadastrada. As opções cadastradas aparecerão aqui.
                </div>
              ) : (
                <div className="grid gap-4 mt-4">
                  {options.map((option) => (
                    <div
                      key={option.documentId}
                      className="flex items-center justify-between border p-4 rounded-md bg-card"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            {option.pitch_order}
                          </span>
                          <h4 className="font-semibold text-sm">{option.name}</h4>
                        </div>
                        {option.description && (
                          <p className="text-sm text-muted-foreground mt-1 ml-8">
                            {option.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <VotingOptionFormDialog
                          onSave={handleAddOption}
                          initialData={option}
                          sessionId={initialData?.documentId}
                          onSubmitSession={handleSaveSessionData}
                          trigger={
                            <Button variant="ghost" size="sm" type="button">
                              Editar
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => handleDeleteOption(option.documentId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Voltar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar Sessão'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
