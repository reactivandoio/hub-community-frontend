'use client';

import { useMutation, useQuery } from '@apollo/client';
import {
  Building2,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { useAdminAccess } from '@/components/admin/admin-guard';
import { FadeIn } from '@/components/animations';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { visibleCommunities } from '@/lib/admin-access';
import {
  CREATE_COMMUNITY,
  DELETE_COMMUNITY,
  GET_COMMUNITIES,
} from '@/lib/queries';

const MANAGER_URL = 'https://manager.hubcommunity.io';

function CommunitiesContent() {
  const access = useAdminAccess();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Auto-open create dialog when ?new=true is in URL
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsCreateOpen(true);
    }
  }, [searchParams]);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMembers, setFormMembers] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, loading, error, refetch } = useQuery(GET_COMMUNITIES);
  const [createCommunity] = useMutation(CREATE_COMMUNITY);
  const [deleteCommunity] = useMutation(DELETE_COMMUNITY);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    try {
      const formData = new FormData();
      formData.append('files', imageFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const uploaded = await response.json();
      // Strapi returns array of uploaded files
      const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      return file?.url
        ? (file.url.startsWith('http') ? file.url : `${MANAGER_URL}${file.url}`)
        : null;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setCreating(true);
    try {
      // Upload image first if provided
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage();
        if (!imageUrl) {
          toast({
            variant: 'destructive',
            title: 'Erro no upload',
            description: 'Não foi possível fazer upload da imagem.',
          });
          setCreating(false);
          return;
        }
      }

      await createCommunity({
        variables: {
          data: {
            title: formTitle.trim(),
            short_description: formDescription.trim() || undefined,
            members_quantity: formMembers ? parseInt(formMembers, 10) : undefined,
          },
        },
      });

      toast({
        title: 'Comunidade criada',
        description: `"${formTitle.trim()}" foi adicionada com sucesso.`,
      });

      // Reset form
      setFormTitle('');
      setFormDescription('');
      setFormMembers('');
      handleRemoveImage();
      setIsCreateOpen(false);
      refetch();
    } catch (err) {
      console.error('Error creating community:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar',
        description: 'Não foi possível criar a comunidade.',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Tem certeza que deseja excluir "${title}"?`)) return;

    try {
      await deleteCommunity({ variables: { id } });
      toast({
        title: 'Comunidade excluída',
        description: `"${title}" foi removida com sucesso.`,
      });
      refetch();
    } catch (err) {
      console.error('Error deleting community:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a comunidade.',
      });
    }
  };

  // A community-manager sees only the communities it organizes.
  const communities = visibleCommunities(access, data?.communities?.data || []);

  const filtered = search.trim()
    ? communities.filter((c: any) =>
        c.title?.toLowerCase().includes(search.toLowerCase()) ||
        c.short_description?.toLowerCase().includes(search.toLowerCase())
      )
    : communities;

  if (loading) {
    return (
      <div className="w-full py-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-10 text-center text-red-500">
        <p>Erro ao carregar comunidades: {error.message}</p>
      </div>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="w-full py-10 px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Gerenciar Comunidades
            </h1>
            <p className="text-muted-foreground mt-2">
              {communities.length} comunidade{communities.length !== 1 ? 's' : ''} cadastrada{communities.length !== 1 ? 's' : ''}
            </p>
          </div>
          {access.isAdmin && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Comunidade
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar comunidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Logo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                <TableHead className="hidden md:table-cell">Membros</TableHead>
                <TableHead className="hidden md:table-cell">Eventos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    {search
                      ? 'Nenhuma comunidade encontrada para esta busca.'
                      : 'Nenhuma comunidade cadastrada.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((community: any) => (
                  <TableRow key={community.id}>
                    <TableCell>
                      {community.images?.[0] ? (
                        <Image
                          src={community.images[0]}
                          alt={community.title || ''}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-lg object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/communities/${community.slug || community.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {community.title}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground line-clamp-1 max-w-[300px]">
                        {community.short_description || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {community.members_quantity ? (
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {community.members_quantity}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {community.events?.length > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {community.events.length} evento{community.events.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Ver comunidade"
                        >
                          <Link href={`/communities/${community.slug || community.id}`} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          title="Excluir"
                          onClick={() => handleDelete(community.id, community.title)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Community Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nova Comunidade</DialogTitle>
            <DialogDescription>
              Adicione uma nova comunidade ao sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5 mt-2">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Imagem</Label>
              {imagePreview ? (
                <div className="relative group w-full h-40 rounded-xl overflow-hidden border border-border/50">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="gap-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50
                           flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground
                           transition-all duration-200 bg-muted/20 hover:bg-muted/40"
                >
                  <ImagePlus className="h-8 w-8" />
                  <span className="text-sm font-medium">Clique para adicionar uma imagem</span>
                  <span className="text-xs text-muted-foreground">PNG, JPG ou WebP</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="community-title">Nome *</Label>
              <Input
                id="community-title"
                placeholder="Nome da comunidade"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="community-description">Descrição curta</Label>
              <Input
                id="community-description"
                placeholder="Uma breve descrição da comunidade"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            {/* Members */}
            <div className="space-y-2">
              <Label htmlFor="community-members">Quantidade de membros</Label>
              <Input
                id="community-members"
                type="number"
                placeholder="Ex: 150"
                value={formMembers}
                onChange={(e) => setFormMembers(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creating || !formTitle.trim()}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Criar Comunidade
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </FadeIn>
  );
}

export default function CommunitiesAdminPage() {
  return (
    <Suspense fallback={
      <div className="w-full py-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <CommunitiesContent />
    </Suspense>
  );
}
