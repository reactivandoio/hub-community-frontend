'use client';

import { SpeakerFormDialog } from '@/components/admin/speaker-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
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
import { CREATE_TALK, GET_SPEAKERS, UPDATE_TALK } from '@/lib/queries';
import {
  talkSchema,
  type TalkFormValues,
} from '@/lib/schemas';
import {
  CreateTalkResponse,
  Speaker,
  SpeakersResponse,
  Talk,
  UpdateTalkResponse,
} from '@/lib/types';
import { useMutation, useQuery } from '@apollo/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

interface TalkInput extends Omit<Talk, 'speakers'> {
  speakerIds: string[];
  speakers: Speaker[];
}

interface TalkFormDialogProps {
  onSave: (talk: any) => void;
  trigger?: React.ReactNode;
  initialData?: Talk;
  eventId?: string;
  onSubmitEvent?: () => Promise<string | undefined>;
}

export function TalkFormDialog({
  onSave,
  trigger,
  initialData,
  eventId,
  onSubmitEvent,
}: TalkFormDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [createTalk, { loading: creating }] =
    useMutation<CreateTalkResponse>(CREATE_TALK);
  const [updateTalk, { loading: updating }] =
    useMutation<UpdateTalkResponse>(UPDATE_TALK);
  const [speakersOptions, setSpeakersOptions] = useState<
    { label: string; value: string; data: Speaker }[]
  >([]);
  const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>(
    initialData?.speakers?.map(s => s.id) || []
  );

  const { data: speakersData, loading: loadingSpeakers } =
    useQuery<SpeakersResponse>(GET_SPEAKERS);

  useEffect(() => {
    if (speakersData?.speakers?.data) {
      const options = speakersData.speakers.data.map(s => ({
        label: s.name,
        value: s.id,
        data: s,
      }));
      setSpeakersOptions(options);
    }
  }, [speakersData]);

  const form = useForm<TalkFormValues>({
    resolver: zodResolver(talkSchema),
    defaultValues: {
      title: initialData?.title || '',
      subtitle: initialData?.subtitle || '',
      description: initialData?.description || [],
      occur_date: initialData?.occur_date || '',
      room_description: initialData?.room_description || '',
      speakerIds: initialData?.speakers?.map(s => s.id) || [],
    },
  });

  const handleAddSpeakerToList = (id: string) => {
    if (!selectedSpeakerIds.includes(id)) {
      const newIds = [...selectedSpeakerIds, id];
      setSelectedSpeakerIds(newIds);
      form.setValue('speakerIds', newIds);
    }
  };

  const handleRemoveSpeaker = (id: string) => {
    const newIds = selectedSpeakerIds.filter(sid => sid !== id);
    setSelectedSpeakerIds(newIds);
    form.setValue('speakerIds', newIds);
  };

  const handleAddSpeaker = (newSpeaker: Speaker) => {
    const id = newSpeaker.id;
    const speakerOption = {
      label: newSpeaker.name,
      value: id,
      data: newSpeaker,
    };
    setSpeakersOptions(prev => [...prev, speakerOption]);
    handleAddSpeakerToList(id);
  };

  const onSubmit = async (data: TalkFormValues) => {
    try {
      let currentEventId = eventId;

      // If no eventId and we have a way to save the event, save it first
      if (!currentEventId && onSubmitEvent) {
        toast({
          title: 'Salvando evento...',
          description:
            'O evento precisa ser salvo antes de adicionar palestras.',
        });
        currentEventId = await onSubmitEvent();
      }

      if (!currentEventId) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível obter o ID do evento.',
        });
        return;
      }

      const selectedSpeakerIdsList = data.speakerIds;
      const selectedSpeakerList = speakersOptions
        .filter(s => data.speakerIds.includes(s.value))
        .map(s => s.data);

      const talkInput: Record<string, any> = {
        title: data.title,
        subtitle: data.subtitle,
        description: data.description,
        speakers: selectedSpeakerIdsList,
        occur_date:
          data.occur_date.length === 16
            ? `${data.occur_date}:00`
            : data.occur_date,
        event: currentEventId,
        highlight: false,
      };

      if (data.room_description?.trim()) {
        talkInput.room_description = data.room_description.trim();
      }

      if (initialData?.id && !initialData.id.startsWith('new-talk')) {
        // Update existing talk
        const { data: responseData } = await updateTalk({
          variables: {
            updateTalkId: initialData.id,
            data: talkInput,
          },
        });

        if (responseData?.updateTalk) {
          onSave(responseData.updateTalk);
          toast({
            title: 'Palestra atualizada',
            description: 'A palestra foi atualizada com sucesso.',
          });
        }
      } else {
        // Create new talk
        const { data: responseData } = await createTalk({
          variables: {
            data: talkInput,
          },
        });

        if (responseData?.createTalk) {
          onSave(responseData.createTalk);
          toast({
            title: 'Palestra criada',
            description: 'A palestra foi criada com sucesso.',
          });
        }
      }

      setOpen(false);
      form.reset();
    } catch (err) {
      console.error('Error saving talk:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar palestra',
        description: 'Não foi possível salvar a palestra.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Adicionar Palestra</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Palestra' : 'Adicionar Nova Palestra'}
          </DialogTitle>
          <DialogDescription>
            Detalhes da palestra e palestrante.
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
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Título da palestra" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subtitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subtítulo</FormLabel>
                  <FormControl>
                    <Input placeholder="Subtítulo ou cargo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="occur_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data e Hora</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="room_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sala / Local (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Auditório Principal, Sala 2..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Speaker Selection */}
            <div className="space-y-3 border p-3 rounded-md">
              <div className="flex items-center justify-between">
                <FormLabel>Palestrantes</FormLabel>
                <SpeakerFormDialog
                  onSave={handleAddSpeaker}
                  trigger={
                    <Button size="sm" variant="ghost" type="button">
                      <Plus className="w-3 h-3 mr-1" /> Novo Palestrante
                    </Button>
                  }
                />
              </div>
              <div className="flex gap-2">
                <Combobox
                  options={speakersOptions}
                  onSelect={handleAddSpeakerToList}
                  placeholder={
                    loadingSpeakers
                      ? 'Carregando palestrantes...'
                      : 'Adicionar um palestrante...'
                  }
                  className="flex-1"
                />
              </div>
              {selectedSpeakerIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSpeakerIds.map(id => {
                    const speaker = speakersOptions.find(s => s.value === id);
                    if (!speaker) return null;
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="flex items-center gap-1 py-1"
                      >
                        <User className="h-3 w-3" />
                        <span>{speaker.label}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpeaker(id)}
                          className="hover:text-destructive transition-colors ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={Array.isArray(field.value) ? field.value : []}
                      onChange={field.onChange}
                      placeholder="Descrição da palestra..."
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
              <Button type="submit" disabled={creating || updating}>
                {creating || updating ? 'Salvando...' : 'Salvar Palestra'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
