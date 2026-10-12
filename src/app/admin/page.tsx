'use client';

import { ArrowRight, Building2, Calendar, Mic, Users, Vote } from 'lucide-react';
import Link from 'next/link';

import { useAdminAccess } from '@/components/admin/admin-guard';
import { AdminPage, AdminPageHeader } from '@/components/admin/admin-page';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/animations';
import { isAdminOnlyPath } from '@/lib/admin-access';

// Who gets in is decided by app/admin/layout.tsx (AdminGuard): signed in, with the admin or
// community-manager role. A community-manager does not see the admin-only modules.
const adminRoutes = [
  {
    title: 'Gerenciar Eventos',
    description: 'Crie, edite e exclua eventos. Gerencie certificados e inscrições.',
    href: '/admin/events',
    icon: Calendar,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderHover: 'hover:border-emerald-500/30',
    shadowHover: 'hover:shadow-emerald-500/5',
  },
  {
    title: 'Gerenciar Palestrantes',
    description: 'Cadastre palestrantes, gerencie avatares e destaques.',
    href: '/admin/speakers',
    icon: Mic,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderHover: 'hover:border-violet-500/30',
    shadowHover: 'hover:shadow-violet-500/5',
  },
  {
    title: 'Sessões de Votação',
    description: 'Crie e gerencie sessões de votação para a comunidade.',
    href: '/admin/voting-sessions',
    icon: Vote,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderHover: 'hover:border-amber-500/30',
    shadowHover: 'hover:shadow-amber-500/5',
  },
  {
    title: 'Gerenciar Comunidades',
    description: 'Cadastre comunidades, gerencie logos e informações.',
    href: '/admin/communities',
    icon: Building2,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderHover: 'hover:border-cyan-500/30',
    shadowHover: 'hover:shadow-cyan-500/5',
  },
  {
    title: 'Usuários e Roles',
    description: 'Busque usuários, defina quem é Admin ou Community Manager e veja o histórico.',
    href: '/admin/usuarios',
    icon: Users,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    borderHover: 'hover:border-rose-500/30',
    shadowHover: 'hover:shadow-rose-500/5',
  },
];

export default function AdminDashboardPage() {
  const access = useAdminAccess();
  const routes = access.isAdmin
    ? adminRoutes
    : adminRoutes.filter((route) => !isAdminOnlyPath(route.href));

  // Admin dashboard
  return (
    <AdminPage>
      <FadeIn direction="up" duration={0.3}>
        <AdminPageHeader
          title="Painel Admin"
          description={
            access.isAdmin
              ? 'Gerencie eventos, palestrantes, comunidades, votações e usuários'
              : `Gerencie as suas comunidades e os eventos delas${
                  access.communities.length
                    ? `: ${access.communities.map((c) => c.title).filter(Boolean).join(', ')}`
                    : ''
                }`
          }
        />
      </FadeIn>

      {/* Content */}
      <div>
        <FadeIn direction="up" duration={0.3} delay={0.05}>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Módulos
          </h2>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-5">
          {routes.map((route) => {
            const Icon = route.icon;
            return (
              <StaggerItem key={route.href}>
                <Link href={route.href} className="block group h-full">
                  <div
                    className={`relative flex flex-col h-full rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 ${route.borderHover} hover:shadow-lg ${route.shadowHover}`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-xl ${route.bgColor} flex items-center justify-center mb-4`}
                    >
                      <Icon className={`h-6 w-6 ${route.color}`} />
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {route.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      {route.description}
                    </p>

                    {/* Footer */}
                    <div className="mt-auto flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Acessar
                      <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </AdminPage>
  );
}
