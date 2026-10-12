'use client';

import { EventForm } from '@/components/admin/event-form';
import { useUnsavedChanges } from '@/components/admin/unsaved-guard';
import { usePaymentsV2 } from '@/hooks/use-payments-v2';
import { FadeIn } from '@/components/animations';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  GET_EVENT_BY_SLUG_OR_ID,
  UPDATE_EVENT,
  UPDATE_EVENT_SALE,
} from '@/lib/queries';
import {
  EventInput,
  EventResponse,
  UpdateEventResponse,
  UpdateEventSaleResponse,
} from '@/lib/types';
import { useMutation, useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  eventFormSection,
  eventIdFromPath,
  eventSectionHref,
  legacyEventHashHref,
  type EventFormSection,
} from '@/lib/admin-nav';
import { centsToReais, reaisToCents } from '@/lib/money';
import { ACCOUNT_REQUIRED_MESSAGE, isAccountRequiredError } from '@/lib/opapingou-account';

const SECTION_TITLES: Record<EventFormSection, { title: string; text: string }> = {
  general: { title: 'Geral', text: 'Título, datas, local, comunidade, capa e descrição do evento.' },
  schedule: { title: 'Programação', text: 'As palestras do evento.' },
  products: { title: 'Produtos & Lotes', text: 'Ingressos, lotes e a conta de pagamento do evento.' },
};

/**
 * The event form behind `/admin/events/<id>`, `/programacao` and `/produtos` (REA-24). It is one
 * form with one "Salvar Evento": rendered by the layout those three routes share, it stays
 * mounted while the sidebar switches between them, so nothing typed is lost. Leaving for any
 * other page with unsaved changes asks first.
 */
export function EventEditor() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const id = params?.id as string;
  const section = eventFormSection(pathname) ?? 'general';
  const [dirty, setDirty] = useState(false);

  // The other parts of this same form keep what was typed; any other link would lose it.
  useUnsavedChanges(dirty, (href) => {
    const path = href.split(/[?#]/)[0];
    return eventIdFromPath(path) === eventIdFromPath(pathname) && eventFormSection(path) !== null;
  });

  // Old links: the sections used to be tabs with a fragment (#schedule, #products).
  useEffect(() => {
    const target = legacyEventHashHref(id, window.location.hash);
    if (target) router.replace(target);
  }, [id, router]);

  const { toast } = useToast();
  const {
    data,
    loading: queryLoading,
    error,
    refetch,
  } = useQuery<EventResponse>(GET_EVENT_BY_SLUG_OR_ID, {
    variables: { slugOrId: id },
    skip: !id,
    fetchPolicy: 'network-only',
  });

  const [updateEvent, { loading: mutationLoading }] =
    useMutation<UpdateEventResponse>(UPDATE_EVENT);
  const [updateEventSale] =
    useMutation<UpdateEventSaleResponse>(UPDATE_EVENT_SALE);
  const [initialData, setInitialData] = useState<any>(null);

  // REA-6 only runs against a BFF that has it: before that, prices stay as typed
  // (the old backend's unit).
  const paymentsV2 = usePaymentsV2();

  useEffect(() => {
    if (data?.eventBySlugOrId && paymentsV2 !== null) {
      const event = data.eventBySlugOrId;
      setInitialData({
        title: event.title,
        slug: event.slug,
        start_date: event.start_date
          ? format(new Date(event.start_date), "yyyy-MM-dd'T'HH:mm")
          : '',
        end_date: event.end_date
          ? format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm")
          : '',
        max_slots: event.max_slots || 0,
        is_online: event.is_online || false,
        call_link: event.call_link || '',
        unlisted: event.unlisted || false,
        description: event.description,
        communityId: event.communities?.[0]?.id, // Get the first community ID if available
        location: event.location,
        id: event.id, // Keep reference for update
        talks: event.talks || [],
        // The form edits prices in reais; Eventando stores cents.
        products: (event.products || []).map((p) => ({
          ...p,
          batches: (p.batches || []).map((b) => ({
            ...b,
            value: paymentsV2 ? centsToReais(b.value) : b.value,
          })),
        })),
        coverImage: event.images?.[0] || null,
      });
    }
  }, [data, paymentsV2]);

  const handleSubmit = async (formData: any) => {
    try {
      const input: EventInput = {
        title: formData.title,
        slug: formData.slug,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        max_slots: Number(formData.max_slots),
        is_online: formData.is_online || false,
        call_link: formData.call_link || '',
        unlisted: formData.unlisted || false,
        description: formData.description,
        images: formData.images,
        location: formData.location?.id || formData.location, // Send ID string
        communities: formData.communityId ? [formData.communityId] : [],
        talks: formData.talks?.map((t: any) => t.id) || [],
      };

      // Ensure we have the id
      const eventId = data?.eventBySlugOrId?.id || id;

      const { data: responseData } = await updateEvent({
        variables: {
          id: eventId,
          data: input,
        },
      });

      // Save products & batches via the separate updateEventSale mutation
      if (formData.products) {
        try {
          await updateEventSale({
            variables: {
              id: eventId,
              data: {
                max_slots: Number(formData.max_slots) || 0,
                products: formData.products.map((p: any) => ({
                  id: (p.id && p.id.toString().startsWith('new-')) ? undefined : p.id || undefined,
                  name: p.name,
                  enabled: p.enabled !== false,
                  batches: (p.batches || []).map((b: any) => ({
                    id: (b.id && b.id.toString().startsWith('new-')) ? undefined : b.id || undefined,
                    batch_number: Number(b.batch_number) || 1,
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
          console.error('Error updating event sale:', saleError);
          toast({
            variant: 'destructive',
            title: 'Erro parcial',
            description: isAccountRequiredError(saleError)
              ? `Evento atualizado, mas os lotes não foram salvos. ${ACCOUNT_REQUIRED_MESSAGE}`
              : 'Evento atualizado, mas houve um erro ao salvar os produtos/lotes.',
          });
        }
      }

      toast({
        title: 'Evento atualizado',
        description: 'O evento foi atualizado com sucesso.',
      });

      // Refetch queries so initial data updates immediately
      await refetch();

      return responseData?.updateEvent?.id || eventId;
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o evento.',
      });
    }
  };

  if (queryLoading) {
    return (
      <div className="w-full py-10 px-4">
        <div className="mb-8">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
          <div className="h-4 w-72 bg-muted animate-pulse rounded" />
        </div>
        <div className="border rounded-lg p-6 bg-card space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-10 w-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-10 text-center text-red-500">
        <p>Erro ao carregar evento: {error.message}</p>
        <Button
          variant="outline"
          onClick={() => router.push('/admin/events')}
          className="mt-4"
        >
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
    <div className="w-full py-10 px-4">
      {/* Analytics, certificados, inscrições and the tools are items of the event's sidebar. */}
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">Editar evento</p>
        <h1 className="text-3xl font-bold tracking-tight">{SECTION_TITLES[section].title}</h1>
        <p className="text-muted-foreground mt-2">{SECTION_TITLES[section].text}</p>
      </div>

      <div className="border rounded-lg p-6 bg-card">
        {initialData && (
          <EventForm
            initialData={initialData}
            onSubmit={handleSubmit}
            isLoading={mutationLoading}
            section={section}
            onSectionChange={(next) => router.push(eventSectionHref(id, next))}
            onDirtyChange={setDirty}
          />
        )}
      </div>
    </div>
    </FadeIn>
  );
}
