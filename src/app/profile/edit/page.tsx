'use client';

import { useMutation, useQuery } from '@apollo/client';
import {
  ArrowLeft,
  Camera,
  Check,
  Github,
  Globe,
  ImagePlus,
  Instagram,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  Phone,
  Save,
  Twitter,
  Upload,
  User,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { FadeIn } from '@/components/animations';
import { LoginRequired } from '@/components/login-required';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { GET_USER_BY_USERNAME, UPDATE_PROFILE } from '@/lib/queries';

const BFF_URL = (process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4001/graphql').replace('/graphql', '');

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BFF_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Erro ao fazer upload.');
  }

  const data = await response.json();
  return data.url;
}

export default function EditProfilePage() {
  const { user, isAuthenticated, isHydrated, isLoading: authLoading, syncUser } = useAuth();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');

  // Fetch fresh user data
  const { data: freshData, loading: freshLoading } = useQuery(GET_USER_BY_USERNAME, {
    variables: { username: user?.username || '' },
    skip: !user?.username,
    fetchPolicy: 'network-only',
  });

  const [updateProfile] = useMutation(UPDATE_PROFILE);

  // Populate form when data loads
  useEffect(() => {
    if (freshData?.userByUsername) {
      const u = freshData.userByUsername;
      setName(u.name || '');
      setPhone(u.phone || '');
      setAvatarUrl(u.speaker?.avatar || '');
      setCoverPhotoUrl(u.cover_photo || '');
      setTwitter(u.twitter || '');
      setLinkedin(u.linkedin || '');
      setGithub(u.github || '');
      setWebsite(u.website || '');
      setInstagram(u.instagram || '');
    }
  }, [freshData]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const url = await uploadFile(file);
      setAvatarUrl(url);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar foto de perfil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const url = await uploadFile(file);
      setCoverPhotoUrl(url);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar foto de capa.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      await updateProfile({
        variables: {
          input: {
            name: name || null,
            phone: phone || null,
            avatar: avatarUrl || null,
            cover_photo: coverPhotoUrl || null,
            twitter: twitter || null,
            linkedin: linkedin || null,
            github: github || null,
            website: website || null,
            instagram: instagram || null,
          },
        },
      });

      if (syncUser) {
        syncUser({
          name: name || undefined,
          phone: phone || undefined,
          avatar: avatarUrl || undefined,
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (str: string) => {
    return str
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (authLoading || freshLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <div className="max-w-2xl mx-auto space-y-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-60 w-full rounded-2xl" />
            <Skeleton className="h-60 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Signed out: the login opens over this page, on the same URL (REA-25).
  if (!isAuthenticated) return isHydrated ? <LoginRequired title="Entre para editar seu perfil" /> : null;

  // Hidden file inputs
  const fileInputs = (
    <>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverUpload}
      />
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {fileInputs}

      {/* Cover Photo Area */}
      <div className="relative h-44 sm:h-56 overflow-hidden">
        {coverPhotoUrl ? (
          <Image
            src={coverPhotoUrl}
            alt="Capa do perfil"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700" />
        )}
        <div className="absolute inset-0 bg-black/80" />

        {/* Back button */}
        <div className="relative container mx-auto px-4 sm:px-6 pt-4 flex items-start justify-between">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-2 text-white/90 hover:text-white transition-colors text-sm font-medium bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          {/* Change cover button */}
          <button
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className="flex items-center gap-2 text-white/90 hover:text-white transition-colors text-sm font-medium bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2"
          >
            {uploadingCover ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {uploadingCover ? 'Enviando...' : 'Alterar Capa'}
          </button>
        </div>
      </div>

      {/* Avatar overlapping cover — positioned with enough space */}
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto -mt-16 relative z-10 flex justify-center">
          <div className="relative group">
            <Avatar className="h-32 w-32 ring-4 ring-background shadow-xl">
              <AvatarImage src={avatarUrl} alt={name || user?.username} className="object-cover" />
              <AvatarFallback className="text-2xl bg-muted">
                {name ? getInitials(name) : user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            {/* Upload overlay */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 pt-6 pb-12">
        <div className="max-w-2xl mx-auto space-y-8">

          {/* Page Title */}
          <FadeIn direction="up" duration={0.3}>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Editar Perfil</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Atualize suas informações pessoais
              </p>
            </div>
          </FadeIn>

          {/* Personal Info Section */}
          <FadeIn direction="up" duration={0.35}>
            <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
              <div className="px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Informações Pessoais
                </h2>
              </div>

              <div className="px-5 sm:px-6 py-4 border-t border-border/40 space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Nome Completo
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Telefone WhatsApp
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+55 11 98765-4321"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    Email
                    <Lock className="h-3 w-3 ml-1" />
                  </Label>
                  <Input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="rounded-xl opacity-60 cursor-not-allowed"
                  />
                </div>

                {/* Username (Read-only) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    Username
                    <Lock className="h-3 w-3 ml-1" />
                  </Label>
                  <Input
                    type="text"
                    value={`@${user?.username || ''}`}
                    disabled
                    className="rounded-xl opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Social Links Section */}
          <FadeIn direction="up" duration={0.4}>
            <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
              <div className="px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Redes Sociais
                </h2>
              </div>

              <div className="px-5 sm:px-6 py-4 border-t border-border/40 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-2 text-sm">
                    <Instagram className="h-4 w-4 text-pink-500" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    type="url"
                    placeholder="https://instagram.com/seu_usuario"
                    value={instagram}
                    onChange={e => setInstagram(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twitter" className="flex items-center gap-2 text-sm">
                    <Twitter className="h-4 w-4 text-sky-500" />
                    Twitter / X
                  </Label>
                  <Input
                    id="twitter"
                    type="url"
                    placeholder="https://twitter.com/seu_usuario"
                    value={twitter}
                    onChange={e => setTwitter(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="flex items-center gap-2 text-sm">
                    <Linkedin className="h-4 w-4 text-blue-600" />
                    LinkedIn
                  </Label>
                  <Input
                    id="linkedin"
                    type="url"
                    placeholder="https://linkedin.com/in/seu_usuario"
                    value={linkedin}
                    onChange={e => setLinkedin(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github" className="flex items-center gap-2 text-sm">
                    <Github className="h-4 w-4 text-foreground" />
                    GitHub
                  </Label>
                  <Input
                    id="github"
                    type="url"
                    placeholder="https://github.com/seu_usuario"
                    value={github}
                    onChange={e => setGithub(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-emerald-500" />
                    Website
                  </Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://seu-site.com"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Save Button */}
          <FadeIn direction="up" duration={0.45}>
            <div className="space-y-3">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  <button onClick={() => setError('')}>
                    <X className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              )}

              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    Perfil atualizado com sucesso!
                  </p>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || uploadingAvatar || uploadingCover}
                className="w-full rounded-xl h-12 text-base font-medium"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </FadeIn>

        </div>
      </div>
    </div>
  );
}
