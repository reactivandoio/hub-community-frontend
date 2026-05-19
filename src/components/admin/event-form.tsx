'use client';

import { CommunityFormDialog } from '@/components/admin/community-form-dialog';
import { ImageCropDialog } from '@/components/admin/image-crop-dialog';
import { LocationFormDialog } from '@/components/admin/location-form-dialog';
import { ProductFormDialog } from '@/components/admin/product-form-dialog';
import { TalkFormDialog } from '@/components/admin/talk-form-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GET_COMMUNITIES, GET_LOCATIONS } from '@/lib/queries';
import { Community, EventLocation, Product, Talk } from '@/lib/types';
import { useQuery } from '@apollo/client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Calendar,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Upload,
  User as UserIcon,
  Users,
  Video,
  X,
} from 'lucide-react';
import Image from 'next/image';
import {
  createEventSchema,
  type CreateEventFormValues,
} from '@/lib/schemas';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

interface EventFormProps {
  initialData?: CreateEventFormValues & { id?: string };
  onSubmit: (data: CreateEventFormValues) => Promise<string | undefined>;
  isLoading?: boolean;
}

// Mock locations - deprecated, now using GET_LOCATIONS
const MOCK_LOCATIONS: { label: string; value: string; data: EventLocation }[] =
  [];

// Mock communities - deprecated, now using GET_COMMUNITIES
const MOCK_COMMUNITIES: {
  label: string;
  value: string;
  data: Partial<Community>;
}[] = [];

export function EventForm({
  initialData,
  onSubmit,
  isLoading,
}: EventFormProps) {
  const router = useRouter();
  const { toast: formToast } = useToast();
  const isEditing = !!initialData?.id;

  // Location State
  const [locations, setLocations] = useState(MOCK_LOCATIONS);
  const [selectedLocationId, setSelectedLocationId] = useState<
    string | undefined
  >(initialData?.location?.id);

  const { data: locationsData } = useQuery(GET_LOCATIONS);

  useEffect(() => {
    if (locationsData?.locations?.data) {
      const options = locationsData.locations.data.map((loc: any) => ({
        label: loc.title || 'Sem título',
        value: loc.id,
        data: loc,
      }));
      setLocations(options);

      // If we have initialData and the location is in the list, ensure it's selected
      const initialLocId = initialData?.location?.id;
      if (initialLocId && !selectedLocationId) {
        setSelectedLocationId(initialLocId);
      }
    }
  }, [locationsData, initialData, selectedLocationId]);

  // Community State
  const [communities, setCommunities] = useState(MOCK_COMMUNITIES);
  const [selectedCommunityId, setSelectedCommunityId] = useState<
    string | undefined
  >(initialData?.communityId);

  const { data: communitiesData } = useQuery(GET_COMMUNITIES);

  useEffect(() => {
    if (communitiesData?.communities?.data) {
      const options = communitiesData.communities.data.map((comm: any) => ({
        label: comm.title,
        value: comm.id,
        data: comm,
      }));
      setCommunities(options);

      // If we have initialData and the community is in the list, ensure it's selected
      if (initialData?.communityId && !selectedCommunityId) {
        setSelectedCommunityId(initialData.communityId);
      }
    }
  }, [communitiesData, initialData, selectedCommunityId]);

  // Talks State
  const [talks, setTalks] = useState<Talk[]>(initialData?.talks || []);

  // Products State
  const [products, setProducts] = useState<Product[]>(
    initialData?.products || []
  );

  useEffect(() => {
    if (initialData?.products) {
      setProducts(initialData.products);
      form.setValue('products', initialData.products);
    }
  }, [initialData?.products]);

  // Image Upload State
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    (initialData as any)?.coverImage || null
  );
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop Dialog State
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    // Read as data URL and open crop dialog
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCropComplete = useCallback((croppedFile: File, previewUrl: string) => {
    setCoverImageFile(croppedFile);
    setCoverImagePreview(previewUrl);
    setCropDialogOpen(false);
    setRawImageSrc(null);
  }, []);

  const handleCropClose = useCallback(() => {
    setCropDialogOpen(false);
    setRawImageSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect]
  );

  const handleRemoveImage = () => {
    setCoverImagePreview(null);
    setCoverImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const form = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: initialData || {
      title: '',
      slug: '',
      start_date: '',
      end_date: '',
      max_slots: 0,
      pixai_token_integration: '',
      is_online: false,
      call_link: '',
      description: [],
      location: undefined,
      communityId: undefined,
      talks: [],
      products: [],
    },
  });

  const isOnline = form.watch('is_online');

  // Tabs state synced with URL hash
  const [activeTab, setActiveTab] = useState<string>('general');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['general', 'schedule', 'products'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    
    // Check initial hash
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.location.hash = value;
  };

  const generateSlug = () => {
    const title = form.getValues('title');
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    form.setValue('slug', slug);
  };

  const handleAddLocation = (newLocation: EventLocation) => {
    if (newLocation.id) {
      setSelectedLocationId(newLocation.id);
      form.setValue('location', newLocation.id);
    }
  };

  const handleLocationSelect = (id: string) => {
    setSelectedLocationId(id);
    const loc = locations.find(l => l.value === id);
    if (loc) {
      form.setValue('location', loc.data);
    }
  };

  // Community Handlers
  const handleAddCommunity = (newCommunity: any) => {
    const newOption = {
      label: newCommunity.title,
      value: newCommunity.id,
      data: newCommunity,
    };
    setCommunities(prev => [...prev, newOption]);
    setSelectedCommunityId(newCommunity.id);
    form.setValue('communityId', newCommunity.id);
  };

  const handleCommunitySelect = (id: string) => {
    setSelectedCommunityId(id);
    form.setValue('communityId', id);
  };

  // Talk Handlers
  const handleAddTalk = (newTalk: any) => {
    const talkWithId = { ...newTalk, id: newTalk.id || `talk-${Date.now()}` };
    const updatedTalks = [...talks, talkWithId];
    setTalks(updatedTalks);
    form.setValue('talks', updatedTalks);
  };

  const handleRemoveTalk = (id: string) => {
    const updatedTalks = talks.filter(t => t.id !== id);
    setTalks(updatedTalks);
    form.setValue('talks', updatedTalks);
  };

  // Product Handlers
  const handleAddProduct = (newProduct: any) => {
    setProducts(prev => {
      const prod = { ...newProduct, id: newProduct.id || `prod-${Date.now()}` };
      const updatedProducts = [...prev, prod];
      form.setValue('products', updatedProducts);
      return updatedProducts;
    });
  };

  const handleSaveEventForTalk = async (): Promise<string | undefined> => {
    const isValid = await form.trigger();
    if (isValid) {
      return await onSubmit(form.getValues());
    }
    return undefined;
  };

  const handleFormSubmit = async (data: CreateEventFormValues) => {
    const eventId = await onSubmit(data);

    // 1. Upload cover image FIRST if a new file was selected
    if (coverImageFile) {
      setIsUploading(true);
      try {
        const uploadData = new FormData();
        uploadData.append('files', coverImageFile);
        // DO NOT append ref, refId, field to avoid 500 error when ID is UUID

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          console.error('Upload error:', errData);
        } else {
          const res = await uploadRes.json();
          if (res && res.length > 0) {
             uploadedImagesResult = res.map((r: any) => r.id?.toString() || r.documentId);
          }
        }
      } catch (err) {
        console.error('Error uploading cover image:', err);
      } finally {
        setIsUploading(false);
      }
    }

    // 2. Add uploaded image ID to formData so the mutation can use it
    if (uploadedImagesResult) {
       data.images = uploadedImagesResult;
    }

    // 3. Submit
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit, (errors) => {
          // Auto-navigate to the tab that contains the first error
          const generalFields = ['title', 'slug', 'start_date', 'end_date', 'max_slots', 'description', 'location', 'communityId', 'pixai_token_integration', 'is_online', 'call_link', 'images'];
          const scheduleFields = ['talks'];
          const productFields = ['products'];
          const errorKeys = Object.keys(errors);
          if (errorKeys.some(k => generalFields.includes(k))) {
            setActiveTab('general');
          } else if (errorKeys.some(k => scheduleFields.includes(k))) {
            setActiveTab('schedule');
          } else if (errorKeys.some(k => productFields.includes(k))) {
            setActiveTab('products');
          }
          const firstError = Object.values(errors)[0];
          formToast({
            variant: 'destructive',
            title: 'Campos obrigatórios',
            description: (firstError as any)?.message || 'Corrija os erros para salvar.',
          });
        })} className="space-y-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="schedule">Programação</TabsTrigger>
            <TabsTrigger value="products">Produtos & Lotes</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título do Evento</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Workshop de React"
                        {...field}
                        onChange={e => {
                          field.onChange(e);
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
                    <FormLabel>Slug (URL amigável)</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="ex-workshop-de-react"
                          {...field}
                          disabled={isEditing}
                        />
                      </FormControl>
                      {isEditing ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `/events/${field.value || initialData?.slug}`,
                              '_blank'
                            )
                          }
                        >
                          Ver página
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={generateSlug}
                        >
                          Gerar
                        </Button>
                      )}
                    </div>
                    <FormDescription>
                      Url que será usada para acessar o evento.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="block"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Término</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="block"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_slots"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vagas Máximas</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Online Event Section */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Evento Online
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Ative se o evento será realizado online
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="is_online"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {isOnline && (
                <FormField
                  control={form.control}
                  name="call_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Link da Chamada
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://meet.google.com/xxx-yyyy-zzz"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Link do Google Meet, Zoom, ou outra plataforma de videoconferência.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Cover Image Upload Section */}
            <div className="space-y-4 rounded-lg border p-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Imagem de Capa
              </Label>

              {coverImagePreview ? (
                <div className="relative rounded-lg overflow-hidden border">
                  <Image
                    src={coverImagePreview}
                    alt="Capa do evento"
                    width={800}
                    height={400}
                    className="w-full h-48 object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Clique para selecionar ou arraste uma imagem
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG ou WebP (recomendado 1200×630)
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                }}
              />

              {isUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando imagem...
                </div>
              )}
            </div>

            {/* Location Section */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">
                  Local do Evento
                </FormLabel>
                <LocationFormDialog
                  onSave={handleAddLocation}
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Local
                    </Button>
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormItem className="flex-1">
                  <FormLabel>Selecionar Local</FormLabel>
                  <Combobox
                    options={locations}
                    value={selectedLocationId}
                    onSelect={handleLocationSelect}
                    placeholder="Selecione um local..."
                  />
                </FormItem>
                {selectedLocationId &&
                  (() => {
                    const loc = locations.find(
                      l => l.value === selectedLocationId
                    )?.data;
                    return loc ? (
                      <div className="text-sm text-muted-foreground pt-8">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>
                            {loc.city}/{loc.region} - {loc.full_address}
                          </span>
                        </div>
                      </div>
                    ) : null;
                  })()}
              </div>
            </div>

            {/* Community Section */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">
                  Comunidade
                </FormLabel>
                <CommunityFormDialog
                  onSave={handleAddCommunity}
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Comunidade
                    </Button>
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormItem className="flex-1">
                  <FormLabel>Selecionar Comunidade</FormLabel>
                  <Combobox
                    options={communities}
                    value={selectedCommunityId}
                    onSelect={handleCommunitySelect}
                    placeholder="Selecione uma comunidade..."
                  />
                </FormItem>
                {selectedCommunityId &&
                  (() => {
                    const comm = communities.find(
                      c => c.value === selectedCommunityId
                    )?.data;
                    return comm ? (
                      <div className="text-sm text-muted-foreground pt-8">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>
                            {comm.title} ({comm.slug})
                          </span>
                        </div>
                      </div>
                    ) : null;
                  })()}
              </div>
            </div>

            {!isEditing && (
              <FormField
                control={form.control}
                name="pixai_token_integration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token de Integração Pix Aí</FormLabel>
                    <FormControl>
                      <Input placeholder="Token do Pix Aí" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormDescription>
                      Insira o token de integração do Pix Aí.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                      placeholder="Descreva os detalhes do evento..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6 mt-6">
            {/* Talks Section */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">
                  Palestras (Talks)
                </FormLabel>
                <TalkFormDialog
                  onSave={handleAddTalk}
                  eventId={initialData?.id}
                  onSubmitEvent={handleSaveEventForTalk}
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Palestra
                    </Button>
                  }
                />
              </div>

              {talks.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
                  Nenhuma palestra cadastrada.
                </div>
              ) : (
                <div className="grid gap-4">
                  {talks.map(talk => (
                    <div
                      key={talk.id}
                      className="flex items-start justify-between border p-4 rounded-md"
                    >
                      <div>
                        <h4 className="font-semibold">{talk.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {talk.subtitle}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{talk.occur_date}</span>
                          {talk.speakers?.map(s => (
                            <div
                              key={s.id}
                              className="flex items-center gap-1 ml-2"
                            >
                              <UserIcon className="h-3 w-3" />
                              <span>{s.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TalkFormDialog
                          onSave={updatedTalk => {
                            const newTalks = talks.map(t =>
                              t.id === talk.id ? updatedTalk : t
                            );
                            setTalks(newTalks);
                            form.setValue('talks', newTalks);
                          }}
                          initialData={talk}
                          eventId={initialData?.id}
                          onSubmitEvent={handleSaveEventForTalk}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Editar
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveTalk(talk.id)}
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

          <TabsContent value="products" className="space-y-6 mt-6">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">
                  Produtos & Lotes
                </FormLabel>
                <ProductFormDialog
                  onSave={handleAddProduct}
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Produto
                    </Button>
                  }
                />
              </div>

              {products.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
                  Nenhum produto cadastrado.
                </div>
              ) : (
                <div className="grid gap-4">
                  {products.map(product => (
                    <div
                      key={product.id || product.name}
                      className="border p-4 rounded-md"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            {product.name}
                            {!product.enabled && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                Inativo
                              </span>
                            )}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <ProductFormDialog
                            onSave={updatedProduct => {
                              setProducts(prev => {
                                const newProducts = prev.map(p =>
                                  (p.id || p.name) === (product.id || product.name) ? updatedProduct : p
                                );
                                form.setValue('products', newProducts);
                                return newProducts;
                              });
                            }}
                            initialData={product}
                            trigger={
                              <Button type="button" variant="ghost" size="sm">
                                Editar
                              </Button>
                            }
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o produto "{product.name}"? Esta ação removerá o produto e seus lotes do evento imediatamente. (Inscritos existentes não perderão o acesso).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    let latestProducts: any[] = [];
                                    setProducts(prev => {
                                      const updated = prev.filter(
                                        p => (p.id || p.name) !== (product.id || product.name)
                                      );
                                      form.setValue('products', updated);
                                      latestProducts = updated;
                                      return updated;
                                    });
                                    
                                    // Trigger form save immediately by explicit payload construction
                                    setTimeout(async () => {
                                      const currentValues = form.getValues();
                                      await onSubmit({
                                        ...currentValues,
                                        products: latestProducts
                                      });
                                    }, 0);
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {product.batches && product.batches.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {product.batches.map((batch: any, index: number) => (
                            <div
                              key={index}
                              className="text-sm text-muted-foreground flex items-center gap-2"
                            >
                              <div className="w-2 h-2 rounded-full bg-primary/50" />
                              <span>
                                Lote {batch.batch_number}: R$ {batch.value} (
                                {batch.max_quantity || 'Ilimitado'} un.)
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground mt-1 italic">
                          Sem lotes configurados
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar Evento'}
          </Button>
        </div>
      </form>

      {/* Image Crop Dialog */}
      {rawImageSrc && (
        <ImageCropDialog
          open={cropDialogOpen}
          imageSrc={rawImageSrc}
          onClose={handleCropClose}
          onCropComplete={handleCropComplete}
        />
      )}
    </Form>
  );
}
