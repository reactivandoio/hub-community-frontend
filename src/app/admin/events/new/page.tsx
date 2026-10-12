'use client';

import { useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';

import { EventForm } from '@/components/admin/event-form';
import { FadeIn } from '@/components/animations';
import { useToast } from '@/hooks/use-toast';
import { CONNECT_EVENT_OPAPINGOU, CREATE_EVENT, UPDATE_EVENT_SALE } from '@/lib/queries';
import { hasPaidBatch, isAccountRequiredError, opaPingouErrorMessage, ACCOUNT_REQUIRED_MESSAGE } from '@/lib/opapingou-account';
import { CreateEventResponse, EventInput, UpdateEventSaleResponse } from '@/lib/types';
import { reaisToCents } from '@/lib/money';
import { usePaymentsV2 } from '@/hooks/use-payments-v2';

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  // Batch prices go in cents only once the backend expects them (REA-6).
  const paymentsV2 = usePaymentsV2();
  const [createEvent, { loading }] =
    useMutation<CreateEventResponse>(CREATE_EVENT);
  const [updateEventSale] =
    useMutation<UpdateEventSaleResponse>(UPDATE_EVENT_SALE);
  const [connectOpaPingou] = useMutation(CONNECT_EVENT_OPAPINGOU);

  const handleSubmit = async (data: any) => {
    try {
      const input: EventInput = {
        title: data.title,
        slug: data.slug,
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
        max_slots: Number(data.max_slots),
        is_online: data.is_online || false,
        call_link: data.call_link || '',
        unlisted: data.unlisted || false,
        description: data.description, // Assuming it's compatible or handled by backend/form
        images: data.images,
        communities: data.communityId ? [data.communityId] : [],
        location: data.location?.id || data.location,
        talks: data.talks?.map((t: any) => t.id) || [],
      };

      const { data: responseData } = await createEvent({
        variables: { data: input },
      });

      const eventId = responseData?.createEvent?.id;

      // REA-12: the key typed in the card is connected now, before the lots (a paid lot needs it).
      let connectError: string | null = null;
      if (eventId && data.opaPingouApiKey) {
        try {
          await connectOpaPingou({ variables: { eventId, apiKey: data.opaPingouApiKey } });
        } catch (err) {
          connectError = opaPingouErrorMessage(err);
        }
      }

      if (connectError && hasPaidBatch(data.products)) {
        toast({
          variant: 'destructive',
          title: 'Evento criado, sem a conta Opa Pingou',
          description: `${connectError} Os lotes não foram salvos: abra o evento, conecte a conta e salve de novo.`,
        });
        return eventId;
      }
      if (connectError) {
        toast({ variant: 'destructive', title: 'Conta Opa Pingou não conectada', description: connectError });
      }

      // Save products & batches via the separate updateEventSale mutation
      if (eventId && data.products && data.products.length > 0) {
        try {
          await updateEventSale({
            variables: {
              id: eventId,
              data: {
                max_slots: Number(data.max_slots) || 0,
                products: data.products.map((p: any) => ({
                  name: p.name,
                  enabled: p.enabled !== false,
                  batches: (p.batches || []).map((b: any) => ({
                    batch_number: Number(b.batch_number) || 1,
                    // Cents only once the backend expects them (REA-6); before that, as typed.
                    value: paymentsV2 ? reaisToCents(b.value) : Number(b.value) || 0,
                    max_quantity: Number(b.max_quantity) || 0,
                    valid_from: b.valid_from || undefined,
                    valid_until: b.valid_until || undefined,
                    enabled: b.enabled !== false,
                    half_price_eligible: b.half_price_eligible || false,
                  })),
                })),
              },
            },
          });
        } catch (saleError) {
          console.error('Error saving event products:', saleError);
          toast({
            variant: 'destructive',
            title: 'Erro parcial',
            description: isAccountRequiredError(saleError)
              ? `Evento criado, mas os lotes não foram salvos. ${ACCOUNT_REQUIRED_MESSAGE}`
              : 'Evento criado, mas houve um erro ao salvar os produtos/lotes.',
          });
        }
      }

      toast({
        title: 'Evento criado',
        description: 'O evento foi criado com sucesso.',
      });

      return eventId;
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar',
        description:
          'Não foi possível criar o evento. Verifique os dados e tente novamente.',
      });
    }
  };

  return (
    <FadeIn direction="up" duration={0.3}>
    <div className="container mx-auto py-10 px-4 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Novo Evento</h1>
        <p className="text-muted-foreground mt-2">
          Preencha os detalhes abaixo para criar um novo evento.
        </p>
      </div>

      <div className="border rounded-lg p-6 bg-card">
        <EventForm
          onSubmit={handleSubmit}
          onSaved={id => router.push(`/admin/events/${id}`)}
          isLoading={loading || paymentsV2 === null}
        />
      </div>
    </div>
    </FadeIn>
  );
}
