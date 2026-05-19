'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import {
  eventRegistrationSchema,
  type EventRegistrationFormValues,
} from '@/lib/schemas';

interface EventRegistrationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EventRegistrationFormValues) => void | Promise<void>;
  eventTitle?: string;
}

export function EventRegistrationForm({
  isOpen,
  onClose,
  onSubmit,
  eventTitle = 'este evento',
}: EventRegistrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<EventRegistrationFormValues>({
    resolver: zodResolver(eventRegistrationSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
    },
  });

  const handleSubmit = async (data: EventRegistrationFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      onClose();
      toast({
        title: 'Inscrição realizada!',
        description: 'Você foi inscrito com sucesso no evento.',
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na inscrição',
        description: error instanceof Error ? error.message : 'Não foi possível realizar a inscrição. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto">
        <SheetHeader>
          <SheetTitle>Participar do Evento</SheetTitle>
          <SheetDescription>
            Preencha seus dados para participar de {eventTitle}.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6 mt-6"
          >
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="João da Silva"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="joao@exemplo.com"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+55 11 98765-4321"
                      {...field}
                      maxLength={20}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Enviando...' : 'Confirmar Participação'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
