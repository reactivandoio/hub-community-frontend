'use client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  locationSchema,
  type LocationFormValues,
} from '@/lib/schemas';
import { CREATE_LOCATION, GET_LOCATIONS } from '@/lib/queries';
import { EventLocation } from '@/lib/types';
import regionAndCities from '@/utils/regionAndCities.json';
import { useMutation } from '@apollo/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

interface LocationFormDialogProps {
  onSave: (location: EventLocation) => void;
  trigger?: React.ReactNode;
}

export function LocationFormDialog({
  onSave,
  trigger,
}: LocationFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [createLocation, { loading: isCreating }] = useMutation(
    CREATE_LOCATION,
    {
      refetchQueries: [{ query: GET_LOCATIONS }],
    }
  );

  const isDev = process.env.NODE_ENV === 'development';

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: isDev
      ? {
          title: 'SENAI',
          region: 'GO',
          city: 'Anápolis',
          full_address: 'rua endereço',
          google_maps_url:
            'https://www.google.com/maps/place/SENAI+Roberto+Mange+-+An%C3%A1polis/@-16.331037,-48.9529389,17z/data=!3m1!4b1!4m6!3m5!1s0x935ea46335ddcb0d:0x114ab43a21f628ce!8m2!3d-16.3310422!4d-48.950364!16s%2Fg%2F1tff8pp8?entry=ttu&g_ep=EgoyMDI2MDIxOC4wIKXMDSoASAFQAw%3D%3D',
          latitude: -16.331037,
          longitude: -48.9529389,
        }
      : {
          title: '',
          region: '',
          full_address: '',
          city: '',
          google_maps_url: '',
          latitude: 0,
          longitude: 0,
        },
  });

  const selectedRegion = form.watch('region');
  const googleMapsUrl = form.watch('google_maps_url');

  useEffect(() => {
    if (googleMapsUrl) {
      // Pattern for standard Google Maps URLs: @lat,long
      const standardPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const match = googleMapsUrl.match(standardPattern);

      if (match) {
        form.setValue('latitude', parseFloat(match[1]));
        form.setValue('longitude', parseFloat(match[2]));
      }
    }
  }, [googleMapsUrl, form]);

  const availableCities =
    regionAndCities.estados.find(e => e.sigla === selectedRegion)?.cidades ||
    [];

  const onSubmit = async (data: LocationFormValues) => {
    try {
      const { data: result } = await createLocation({
        variables: {
          data,
        },
      });

      if (result?.createLocation) {
        onSave(result.createLocation);
        setOpen(false);
        form.reset();
      }
    } catch (error) {
      console.error('Error creating location:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Adicionar Local</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Local</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo local para o evento.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={e => {
              e.stopPropagation();
              form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Local</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Centro de Convenções" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado (UF)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {regionAndCities.estados.map(estado => (
                          <SelectItem key={estado.sigla} value={estado.sigla}>
                            {estado.sigla} - {estado.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Combobox
                        options={availableCities.map(city => ({
                          label: city,
                          value: city,
                        }))}
                        value={field.value}
                        onSelect={field.onChange}
                        placeholder="Selecione a cidade"
                        disabled={!selectedRegion}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="full_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, Número, Bairro, CEP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="google_maps_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link do Google Maps</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://maps.google.com/..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
