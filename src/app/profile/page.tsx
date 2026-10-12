'use client';

import { useQuery } from '@apollo/client';
import {
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  Pencil,
  Phone,
  Shield,
  Sun,
  User,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { FadeIn } from '@/components/animations';
import { InstallAppRow } from '@/components/install-banner';
import { ProfileSkeleton } from '@/components/profile-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoginRequired } from '@/components/login-required';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAgenda } from '@/contexts/agenda-context';
import { useAuth } from '@/contexts/auth-context';
import { GET_USER_BY_USERNAME } from '@/lib/queries';

export default function ProfilePage() {
  const { user, isAuthenticated, isHydrated, signOut, isLoading, updatePhone, syncUser } = useAuth();
  const { agendas, isLoading: agendasLoading } = useAgenda();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [phoneInput, setPhoneInput] = useState('');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  // Fetch fresh user data from BFF to sync with localStorage
  const { data: freshUserData } = useQuery(GET_USER_BY_USERNAME, {
    variables: { username: user?.username || '' },
    skip: !user?.username,
    fetchPolicy: 'network-only',
  });

  // Sync fresh data back to auth context
  useEffect(() => {
    if (freshUserData?.userByUsername && syncUser) {
      const fresh = freshUserData.userByUsername;
      syncUser({
        name: fresh.name || undefined,
        phone: fresh.phone || undefined,
        avatar: fresh.speaker?.avatar || undefined,
      });
    }
  }, [freshUserData]);

  // Leaving on purpose: no "entre para continuar" on the way to the home page.
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = () => {
    setSigningOut(true);
    signOut();
    router.push('/');
  };

  const handlePhoneSubmit = async () => {
    if (!phoneInput.trim()) {
      setPhoneError('Informe um número de telefone.');
      return;
    }
    const cleaned = phoneInput.replace(/[^\d+\s()-]/g, '');
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      setPhoneError('Informe um número válido com código do país (ex: +55 11 98765-4321).');
      return;
    }

    setPhoneError('');
    setIsUpdatingPhone(true);
    try {
      await updatePhone(cleaned);
      setPhoneSuccess(true);
      setTimeout(() => setPhoneSuccess(false), 3000);
    } catch (err: any) {
      setPhoneError(err.message || 'Erro ao atualizar telefone.');
    } finally {
      setIsUpdatingPhone(false);
    }
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (!isAuthenticated) {
    // Signed out: the login opens over this page, on the same URL (REA-25).
    if (!isHydrated || signingOut) return null;
    return <LoginRequired title="Entre para ver seu perfil" />;
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const themeOptions = [
    { key: 'light', label: 'Claro', icon: Sun },
    { key: 'dark', label: 'Escuro', icon: Moon },
    { key: 'system', label: 'Sistema', icon: Monitor },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {freshUserData?.userByUsername?.cover_photo ? (
          <Image
            src={freshUserData.userByUsername.cover_photo}
            alt="Capa do perfil"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700" />
        )}
        <div className="absolute inset-0 bg-black/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="relative container mx-auto px-4 sm:px-6 pt-12 pb-20 sm:pt-16 sm:pb-24">
          <FadeIn direction="up" duration={0.3}>
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-28 w-28 sm:h-32 sm:w-32 ring-4 ring-white/20 shadow-2xl">
                <AvatarImage
                  src={user?.avatar}
                  alt={user?.name || user?.username}
                  className="object-cover"
                />
                <AvatarFallback className="text-2xl sm:text-3xl text-white bg-white/20 backdrop-blur-sm">
                  {user?.name
                    ? getInitials(user.name)
                    : user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-5">
                {user?.name || 'Usuário'}
              </h1>
              <p className="text-white/70 text-base mt-1">
                @{user?.username}
              </p>
              <Badge
                variant="secondary"
                className="mt-3 bg-white/15 text-white border-0 backdrop-blur-sm hover:bg-white/25 transition-colors"
              >
                <Shield className="h-3 w-3 mr-1.5" />
                Membro Ativo
              </Badge>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 -mt-8 pb-12 relative z-10">
        <div className="max-w-2xl mx-auto space-y-8">

          {/* Contact Info Section */}
          <FadeIn direction="up" duration={0.35}>
            <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
              <div className="px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Informações de Contato
                </h2>
              </div>

              {/* Email Row */}
              <div className="px-5 sm:px-6 py-3.5 flex items-center gap-4 border-t border-border/40">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex-shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Phone Row */}
              <div className="px-5 sm:px-6 py-3.5 flex items-center gap-4 border-t border-border/40">
                <div className={`flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0 ${
                  user?.phone
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                }`}>
                  <Phone className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  <p className="text-sm font-medium text-foreground">
                    {user?.phone || 'Não informado'}
                  </p>
                </div>
              </div>

              {/* Username Row */}
              <div className="px-5 sm:px-6 py-3.5 flex items-center gap-4 border-t border-border/40">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10 text-violet-500 flex-shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="text-sm font-medium text-foreground">
                    @{user?.username}
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Phone Alert — only if no phone */}
          {!user?.phone && (
            <FadeIn direction="up" duration={0.4}>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/15 text-amber-500 flex-shrink-0 mt-0.5">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Adicionar WhatsApp
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Receba informações sobre os eventos. Aceita números internacionais.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder="+55 11 98765-4321"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      setPhoneError('');
                    }}
                    disabled={isUpdatingPhone}
                    className="flex-1 rounded-xl"
                  />
                  <Button
                    onClick={handlePhoneSubmit}
                    disabled={isUpdatingPhone || !phoneInput.trim()}
                    className="rounded-xl"
                    size="default"
                  >
                    {isUpdatingPhone ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
                {phoneError && (
                  <p className="text-xs text-red-500 mt-2">{phoneError}</p>
                )}
                {phoneSuccess && (
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    Telefone atualizado com sucesso!
                  </p>
                )}
              </div>
            </FadeIn>
          )}

          {/* My Events / Agendas */}
          <FadeIn direction="up" duration={0.45}>
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Meus Eventos
                </h2>
                {agendas.length > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    {agendas.length}
                  </span>
                )}
              </div>

              {agendasLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="flex items-center gap-3.5 p-3 rounded-xl"
                    >
                      <div className="h-14 w-14 rounded-xl bg-muted animate-pulse flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-4 w-3/4 bg-muted animate-pulse rounded mb-2" />
                        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : agendas.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted/60 mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Nenhuma agenda encontrada
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Adicione eventos à sua agenda para visualizá-los aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
              {agendas.filter(a => a?.event).slice(0, 5).map(agenda => (
                    <Link
                      key={agenda.documentId}
                      href={`/events/${agenda?.event?.documentId}`}
                      className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-accent/60 transition-all duration-200 group"
                    >
                      <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                        {agenda?.event?.images &&
                        agenda?.event?.images.length > 0 ? (
                          <Image
                            src={agenda?.event?.images[0]}
                            alt={agenda?.event?.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
                            <Calendar className="h-6 w-6 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {agenda?.event?.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          Ver detalhes
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                    </Link>
                  ))}
                  {agendas.filter(a => a?.event).length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      E mais {agendas.filter(a => a?.event).length - 5} evento
                      {agendas.filter(a => a?.event).length - 5 > 1 ? 's' : ''}...
                    </p>
                  )}
                </div>
              )}
            </div>
          </FadeIn>

          {/* Appearance */}
          <FadeIn direction="up" duration={0.5}>
            <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
              <div className="px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Preferências
                </h2>
              </div>

              <div className="px-5 sm:px-6 py-4 border-t border-border/40">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex-shrink-0">
                    <Palette className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Aparência</p>
                    <p className="text-xs text-muted-foreground">Escolha o tema da interface</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/40 rounded-xl">
                  {themeOptions.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        theme === key
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Actions */}
          <FadeIn direction="up" duration={0.55}>
            <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
              <div className="px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Conta
                </h2>
              </div>

              {/* Edit Profile */}
              <button
                className="w-full px-5 sm:px-6 py-4 flex items-center gap-4 border-t border-border/40 hover:bg-accent/50 transition-colors duration-200 text-left"
                onClick={() => router.push('/profile/edit')}
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex-shrink-0">
                  <Pencil className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Editar Perfil</p>
                  <p className="text-xs text-muted-foreground">Alterar nome, foto e informações</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
              </button>

              {/* View Public Profile */}
              <Link
                href={`/users/${user?.username}`}
                className="w-full px-5 sm:px-6 py-4 flex items-center gap-4 border-t border-border/40 hover:bg-accent/50 transition-colors duration-200"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex-shrink-0">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Ver Perfil Público</p>
                  <p className="text-xs text-muted-foreground">Veja como outros usuários veem você</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
              </Link>

              {/* Add to Home Screen */}
              <InstallAppRow />

              {/* Sign Out */}
              <button
                className="w-full px-5 sm:px-6 py-4 flex items-center gap-4 border-t border-border/40 hover:bg-red-500/5 transition-colors duration-200 text-left"
                onClick={handleSignOut}
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-500/10 text-red-500 flex-shrink-0">
                  <LogOut className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Sair da Conta</p>
                  <p className="text-xs text-muted-foreground">Encerrar sessão atual</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
              </button>
            </div>
          </FadeIn>

        </div>
      </div>
    </div>
  );
}
