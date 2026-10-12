/**
 * Navigation of the Hub admin (REA-24): what the sidebar lists and what the breadcrumb says for
 * a path. Pure rules, shared by AdminShell and the event editor.
 *
 * The sidebar has two contexts: the general admin, and one event (`/admin/events/<id>` and
 * below), whose items are the sections of that event. Each item has its own URL.
 */
import { isAdminOnlyPath, type AdminAccess } from '@/lib/admin-access';
import { raffleUrl } from '@/lib/raffle';

export type AdminNavIcon =
  | 'dashboard'
  | 'events'
  | 'communities'
  | 'speakers'
  | 'voting'
  | 'users'
  | 'general'
  | 'schedule'
  | 'products'
  | 'coupons'
  | 'analytics'
  | 'signups'
  | 'attendance'
  | 'certificates'
  | 'checkin'
  | 'badge'
  | 'raffle'
  | 'public';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: AdminNavIcon;
  /** Active only on this exact path (not on what is below it). */
  exact?: boolean;
  /** Opens in a new tab (a tool that runs outside the admin). */
  external?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export interface AdminCrumb {
  label: string;
  href: string;
}

const MAIN_ITEMS: AdminNavItem[] = [
  { label: 'Painel', href: '/admin', icon: 'dashboard', exact: true },
  { label: 'Eventos', href: '/admin/events', icon: 'events' },
  { label: 'Comunidades', href: '/admin/communities', icon: 'communities' },
  { label: 'Palestrantes', href: '/admin/speakers', icon: 'speakers' },
  { label: 'Votações', href: '/admin/voting-sessions', icon: 'voting' },
  { label: 'Usuários', href: '/admin/usuarios', icon: 'users' },
];

/** The general admin sidebar: a community-manager does not see the admin-only areas. */
export const mainNavItems = (access: Pick<AdminAccess, 'isAdmin'>): AdminNavItem[] =>
  access.isAdmin ? MAIN_ITEMS : MAIN_ITEMS.filter((item) => !isAdminOnlyPath(item.href));

/** The event id (or slug) when the path is inside one event; null elsewhere, `new` included. */
export const eventIdFromPath = (pathname: string | null | undefined): string | null => {
  const match = /^\/admin\/events\/([^/]+)/.exec(pathname || '');
  if (!match || match[1] === 'new') return null;
  return decodeURIComponent(match[1]);
};

export const eventHref = (id: string, sub = '') =>
  `/admin/events/${encodeURIComponent(id)}${sub ? `/${sub}` : ''}`;

/** The three parts of the event form, which is one form with one "Salvar Evento". */
export type EventFormSection = 'general' | 'schedule' | 'products';

const SECTION_PATHS: Record<EventFormSection, string> = {
  general: '',
  schedule: 'programacao',
  products: 'produtos',
};

export const eventSectionHref = (id: string, section: EventFormSection) =>
  eventHref(id, SECTION_PATHS[section]);

/** Which part of the form a path shows; null when the path is not the event form. */
export const eventFormSection = (pathname: string | null | undefined): EventFormSection | null => {
  const id = eventIdFromPath(pathname);
  if (!id) return null;
  const rest = (pathname || '').replace(/^\/admin\/events\/[^/]+/, '').replace(/^\/|\/$/g, '');
  const found = (Object.keys(SECTION_PATHS) as EventFormSection[]).find(
    (section) => SECTION_PATHS[section] === rest,
  );
  return found ?? null;
};

/**
 * Where an old link with a fragment goes now: the form tabs used to be `#general`, `#schedule`
 * and `#products` on the event page. Null when the fragment is not one of them.
 */
export const legacyEventHashHref = (id: string, hash: string | null | undefined): string | null => {
  const key = (hash || '').replace(/^#/, '');
  if (key === 'general' || key === 'schedule' || key === 'products') return eventSectionHref(id, key);
  return null;
};

/**
 * The sidebar of one event. `slug` is used by the tools that live outside the admin; coupons
 * are admin only and need the BFF with the payment API (as the old "Cupons" tab did).
 */
export const eventNavGroups = ({
  id,
  slug,
  isAdmin,
  paymentsV2,
}: {
  id: string;
  slug?: string | null;
  isAdmin: boolean;
  paymentsV2: boolean | null;
}): AdminNavGroup[] => {
  const publicSlug = slug || id;
  const edit: AdminNavItem[] = [
    { label: 'Geral', href: eventSectionHref(id, 'general'), icon: 'general', exact: true },
    { label: 'Programação', href: eventSectionHref(id, 'schedule'), icon: 'schedule' },
    { label: 'Produtos & Lotes', href: eventSectionHref(id, 'products'), icon: 'products' },
  ];
  if (isAdmin && paymentsV2) {
    edit.push({ label: 'Cupons', href: eventHref(id, 'cupons'), icon: 'coupons' });
  }
  return [
    { label: 'Edição', items: edit },
    {
      label: 'Acompanhamento',
      items: [
        { label: 'Analytics', href: eventHref(id, 'analytics'), icon: 'analytics' },
        { label: 'Inscrições', href: eventHref(id, 'import-signups'), icon: 'signups' },
        { label: 'Presenças', href: eventHref(id, 'attendance'), icon: 'attendance' },
        { label: 'Certificados', href: eventHref(id, 'certificados'), icon: 'certificates' },
      ],
    },
    {
      label: 'Ferramentas',
      items: [
        { label: 'Check-in', href: `/checkin/${publicSlug}`, icon: 'checkin', external: true },
        { label: 'Credenciamento', href: `/badge-printer/event/${publicSlug}`, icon: 'badge', external: true },
        { label: 'Sorteio', href: raffleUrl(publicSlug), icon: 'raffle', external: true },
        { label: 'Página pública', href: `/events/${publicSlug}`, icon: 'public', external: true },
      ],
    },
  ];
};

export const isNavItemActive = (pathname: string | null | undefined, item: AdminNavItem) => {
  if (!pathname || item.external) return false;
  const path = pathname.replace(/\/$/, '') || '/';
  return item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
};

const SEGMENT_LABELS: Record<string, string> = {
  events: 'Eventos',
  communities: 'Comunidades',
  speakers: 'Palestrantes',
  'voting-sessions': 'Votações',
  usuarios: 'Usuários',
};

const EVENT_SUB_LABELS: Record<string, string> = {
  programacao: 'Programação',
  produtos: 'Produtos & Lotes',
  cupons: 'Cupons',
  analytics: 'Analytics',
  'import-signups': 'Inscrições',
  attendance: 'Presenças',
  certificados: 'Certificados',
};

const readable = (segment: string) => {
  const text = decodeURIComponent(segment).replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * The breadcrumb of an admin path, from "Admin" to the current page (the last one). Every level
 * has a real URL. The event shows its title (`eventTitle`), never the id.
 */
export const adminBreadcrumbs = (
  pathname: string | null | undefined,
  { eventTitle }: { eventTitle?: string | null } = {},
): AdminCrumb[] => {
  const crumbs: AdminCrumb[] = [{ label: 'Admin', href: '/admin' }];
  const segments = (pathname || '').split('/').filter(Boolean);
  if (segments[0] !== 'admin' || segments.length < 2) return crumbs;

  const area = segments[1];
  const areaHref = `/admin/${area}`;
  crumbs.push({ label: SEGMENT_LABELS[area] || readable(area), href: areaHref });
  if (segments.length < 3) return crumbs;

  const item = segments[2];
  const itemHref = `${areaHref}/${item}`;

  if (area === 'events') {
    if (item === 'new') {
      crumbs.push({ label: 'Novo evento', href: itemHref });
      return crumbs;
    }
    crumbs.push({ label: eventTitle?.trim() || 'Evento', href: itemHref });
    const sub = segments[3];
    crumbs.push(
      sub
        ? { label: EVENT_SUB_LABELS[sub] || readable(sub), href: `${itemHref}/${sub}` }
        : { label: 'Geral', href: itemHref },
    );
    return crumbs;
  }

  if (area === 'voting-sessions') {
    crumbs.push({ label: item === 'new' ? 'Nova sessão' : 'Editar sessão', href: itemHref });
    return crumbs;
  }

  crumbs.push({ label: readable(item), href: itemHref });
  return crumbs;
};
