'use client';

import { useQuery } from '@apollo/client';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Building2,
  Calendar,
  ChevronsUpDown,
  ClipboardCheck,
  Dices,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Mic,
  Moon,
  PanelLeft,
  Printer,
  QrCode,
  Settings2,
  Shield,
  Sun,
  Tag,
  Ticket,
  User,
  Users,
  Vote,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Fragment, useEffect, useState, type ReactNode } from 'react';

import { useAdminAccess } from '@/components/admin/admin-guard';
import { PageActionsProvider, PageActionsSlot } from '@/components/admin/page-actions';
import { GuardedLink, UnsavedGuardProvider } from '@/components/admin/unsaved-guard';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/auth-context';
import { usePaymentsV2 } from '@/hooks/use-payments-v2';
import {
  adminBreadcrumbs,
  eventIdFromPath,
  eventNavGroups,
  isNavItemActive,
  mainNavItems,
  type AdminNavIcon,
  type AdminNavItem,
} from '@/lib/admin-nav';
import { roleLabel } from '@/lib/admin-access';
import { GET_EVENT_ADMIN_NAV } from '@/lib/queries';
import { cn } from '@/lib/utils';

const ICONS: Record<AdminNavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  events: Calendar,
  communities: Building2,
  speakers: Mic,
  voting: Vote,
  users: Users,
  general: Settings2,
  schedule: ListOrdered,
  products: Ticket,
  coupons: Tag,
  analytics: BarChart3,
  signups: FileSpreadsheet,
  attendance: ClipboardCheck,
  certificates: Award,
  checkin: QrCode,
  badge: Printer,
  raffle: Dices,
  public: Globe,
};

/**
 * The sidebar header and the top bar are one row: same height (`--admin-header-height`, in
 * globals.css) and the same bottom border, so the two lines meet as a single one.
 */
export const HEADER_ROW = 'h-[--admin-header-height] shrink-0 border-b border-border';

/** Remembered between pages and visits (desktop only; the phone drawer always starts closed). */
export const SIDEBAR_STORAGE_KEY = 'admin_sidebar_open';

const readSavedOpen = () => {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
};

function NavItem({ item, pathname }: { item: AdminNavItem; pathname: string }) {
  const Icon = ICONS[item.icon];
  const active = isNavItemActive(pathname, item);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        {item.external ? (
          <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`${item.label} (abre em nova aba)`}>
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
            <ExternalLink aria-hidden="true" className="ml-auto !size-3 opacity-60 group-data-[collapsible=icon]:hidden" />
          </a>
        ) : (
          <GuardedLink href={item.href} aria-current={active ? 'page' : undefined}>
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </GuardedLink>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AdminSidebar({
  pathname,
  eventId,
  event,
}: {
  pathname: string;
  eventId: string | null;
  event?: { slug?: string | null; title?: string | null } | null;
}) {
  const access = useAdminAccess();
  const paymentsV2 = usePaymentsV2();
  const { setOpenMobile, isMobile } = useSidebar();

  // The phone drawer closes once a link was followed.
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="icon">
      {/* On the phone the sidebar is a dialog (drawer), which needs a name for screen readers. */}
      {isMobile && (
        <>
          <SheetTitle className="sr-only">{eventId ? 'Menu do evento' : 'Menu do admin'}</SheetTitle>
          <SheetDescription className="sr-only">Navegação do painel de administração.</SheetDescription>
        </>
      )}
      <SidebarHeader data-testid="sidebar-header" className={cn(HEADER_ROW, 'justify-center py-0')}>
        <SidebarMenu>
          {eventId ? (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Voltar para o admin">
                <GuardedLink href="/admin/events">
                  <ArrowLeft aria-hidden="true" />
                  <span>Voltar para o admin</span>
                </GuardedLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip="Painel Admin">
                <GuardedLink href="/admin">
                  <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Shield aria-hidden="true" className="size-4" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold">Hub Community</span>
                    <span className="text-xs text-sidebar-foreground/70">
                      {access.isAdmin ? 'Admin' : 'Community Manager'}
                    </span>
                  </span>
                </GuardedLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarHeader>
      {/* Below the header line, so the header keeps the height of the top bar. */}
      {eventId && (
        <div className="px-4 pt-3 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-sidebar-foreground/70">Evento</p>
          <p className="text-sm font-semibold leading-snug break-words" data-testid="sidebar-event-title">
            {event?.title || 'Carregando…'}
          </p>
        </div>
      )}
      <SidebarContent role="navigation" aria-label={eventId ? 'Menu do evento' : 'Menu do admin'}>
        {eventId ? (
          eventNavGroups({ id: eventId, slug: event?.slug, isAdmin: access.isAdmin, paymentsV2 }).map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <NavItem key={item.href} item={item} pathname={pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Módulos</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems(access).map((item) => (
                  <NavItem key={item.href} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
        <SidebarUser />
      </SidebarFooter>
      <SidebarRail aria-label="Recolher ou expandir o menu" title="Recolher ou expandir o menu" />
    </Sidebar>
  );
}

function MenuToggle() {
  const { toggleSidebar, isMobile, open, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;
  const label = isMobile ? 'Abrir menu' : expanded ? 'Recolher menu' : 'Expandir menu';
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      onClick={toggleSidebar}
    >
      <PanelLeft aria-hidden="true" className="h-4 w-4" />
    </Button>
  );
}

function AdminBreadcrumb({ pathname, eventTitle }: { pathname: string; eventTitle?: string | null }) {
  const crumbs = adminBreadcrumbs(pathname, { eventTitle });
  return (
    <Breadcrumb aria-label="Você está em" className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          // On a phone only the current page and its parent fit.
          const hideOnPhone = index < crumbs.length - 2 ? 'hidden md:inline-flex' : '';
          return (
            <Fragment key={`${crumb.href}-${index}`}>
              <BreadcrumbItem className={cn('min-w-0', hideOnPhone)}>
                {last ? (
                  <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="truncate">
                    <GuardedLink href={crumb.href}>{crumb.label}</GuardedLink>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator className={hideOnPhone} />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * Who is signed in, at the foot of the sidebar (only the avatar when it is collapsed). Its menu
 * has the profile, the theme, the way back to the public site and the sign out.
 */
function SidebarUser() {
  const { user, signOut } = useAuth();
  const access = useAdminAccess();
  const { isMobile, state } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const name = user?.name || user?.username || 'Conta';
  const role = roleLabel(access.role);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const avatar = (
    <span
      aria-hidden="true"
      className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
    >
      {initial}
    </span>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label={`Conta de ${name}`} tooltip={name}>
              {avatar}
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">{user?.email || role}</span>
              </span>
              <ChevronsUpDown aria-hidden="true" className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64"
            align="end"
            side={isMobile || state === 'expanded' ? 'top' : 'right'}
          >
            <DropdownMenuLabel className="flex items-center gap-2 font-normal">
              {avatar}
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium">{name}</span>
                {user?.email && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
                <span className="truncate text-xs text-muted-foreground">{role}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
          <GuardedLink href="/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </GuardedLink>
        </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              // The menu stays open: the change is seen at once.
              onSelect={(event) => {
                event.preventDefault();
                setTheme(dark ? 'light' : 'dark');
              }}
            >
              {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              <span>{dark ? 'Usar tema claro' : 'Usar tema escuro'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <GuardedLink href="/" className="cursor-pointer">
                <Globe className="mr-2 h-4 w-4" />
                <span>Voltar para o site</span>
              </GuardedLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-500 focus:text-red-500 cursor-pointer" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * The frame of every /admin page (REA-24): a collapsible sidebar (a drawer on the phone), a
 * fixed-height top bar with the breadcrumb, and the page beside and below them. Inside one event
 * the sidebar lists that event's sections. Rendered inside AdminGuard.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/admin';
  const eventId = eventIdFromPath(pathname);

  const [open, setOpen] = useState(true);
  useEffect(() => {
    setOpen(readSavedOpen());
  }, []);
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  };

  const { data } = useQuery<{ eventBySlugOrId: { slug?: string | null; title?: string | null } | null }>(
    GET_EVENT_ADMIN_NAV,
    { variables: { slugOrId: eventId }, skip: !eventId },
  );
  const event = eventId ? data?.eventBySlugOrId : null;

  return (
    <UnsavedGuardProvider>
      <PageActionsProvider>
      <SidebarProvider open={open} onOpenChange={handleOpenChange}>
        <AdminSidebar pathname={pathname} eventId={eventId} event={event} />
        <SidebarInset className="min-w-0">
          <header
            className={cn(
              HEADER_ROW,
              'sticky top-0 z-20 flex items-center gap-2 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6 lg:px-8',
            )}
          >
            <MenuToggle />
            <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
            <AdminBreadcrumb pathname={pathname} eventTitle={event?.title} />
            {/* What each page declares with <AdminPageActions>. */}
            <PageActionsSlot pathname={pathname} />
          </header>
          {/* The pages take the whole width beside the sidebar; they bring 16px of side padding
              and this adds the rest (24px from md, 32px from lg), matching the top bar. */}
          <div className="min-w-0 flex-1 md:px-2 lg:px-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      </PageActionsProvider>
    </UnsavedGuardProvider>
  );
}
