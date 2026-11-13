/**
 * Who may use the Hub admin (REA-10). Pure rules, shared by AdminGuard and the admin pages.
 *
 * The real protection is the BFF: every admin operation checks the role on the server. This
 * only decides what the browser shows, so nobody lands on a screen whose calls would fail.
 * - admin: everything, including users and roles.
 * - community-manager: /admin, check-in, badge printing and the raffle, scoped to the
 *   communities it organizes and their events.
 * - event-manager (REA-48): only the events it manages (`access.events`): no communities, no new
 *   event. A community-manager invited to an event of another community sees it too.
 * - anyone else: no access. Not signed in: the login modal opens on the same page (REA-25).
 */

export type AdminRoleType = 'authenticated' | 'event-manager' | 'community-manager' | 'admin';

export interface AdminCommunityRef {
  id: string;
  title?: string | null;
  slug?: string | null;
}

export interface AdminAccess {
  role: AdminRoleType | string | null;
  isAdmin: boolean;
  isCommunityManager: boolean;
  /** REA-48 */
  isEventManager?: boolean;
  canAccessAdmin: boolean;
  communities: AdminCommunityRef[];
  /** REA-48: the events it manages (`event.managers`). */
  events?: AdminCommunityRef[];
}

/** REA-48: manages events only — no community of its own. */
export const isOnlyEventManager = (
  access: Pick<AdminAccess, 'isAdmin'> & Partial<Pick<AdminAccess, 'isCommunityManager' | 'isEventManager'>>
) =>
  !access.isAdmin && !access.isCommunityManager && Boolean(access.isEventManager);

/** Paths an event-manager never uses: it creates no event and touches no community. */
export const EVENT_MANAGER_BLOCKED_PATHS = ['/admin/communities', '/admin/events/new'];

const EVENT_PATH = /^\/admin\/events\/([^/]+)/;

/** Is this event (documentId or slug) one the user manages? */
export const managesEvent = (access: AdminAccess, idOrSlug: string | null | undefined) =>
  !!idOrSlug && (access.events || []).some((event) => event.id === idOrSlug || event.slug === idOrSlug);

/** REA-48: may an event-manager open this path? Only its events, and nothing of communities. */
export const eventManagerMayOpen = (access: AdminAccess, pathname: string | null | undefined) => {
  const path = pathname || '/admin';
  if (EVENT_MANAGER_BLOCKED_PATHS.some((blocked) => path === blocked || path.startsWith(`${blocked}/`))) {
    return false;
  }
  const match = EVENT_PATH.exec(path);
  return match ? managesEvent(access, decodeURIComponent(match[1])) : true;
};

/** Admin-only areas inside /admin (a community-manager gets "Sem acesso"). */
export const ADMIN_ONLY_PATHS = ['/admin/usuarios', '/admin/speakers', '/admin/voting-sessions'];

export const isAdminOnlyPath = (pathname: string | null | undefined) =>
  !!pathname &&
  ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export type AdminGateState =
  | { status: 'checking' }
  | { status: 'login' }
  | { status: 'error' }
  | { status: 'forbidden' }
  | { status: 'allowed'; access: AdminAccess };

export const adminGate = ({
  isHydrated,
  isAuthenticated,
  loading,
  error,
  access,
  requireAdmin,
  pathname,
}: {
  isHydrated: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  error: boolean;
  access: AdminAccess | null | undefined;
  requireAdmin: boolean;
  /** REA-48: an event-manager is kept to its events. */
  pathname?: string | null;
}): AdminGateState => {
  if (!isHydrated) return { status: 'checking' };
  if (!isAuthenticated) return { status: 'login' };
  if (loading && !access) return { status: 'checking' };
  if (error && !access) return { status: 'error' };
  // A token the BFF does not accept (expired, revoked) comes back as null: sign in again.
  if (!access) return { status: 'login' };
  if (!access.canAccessAdmin) return { status: 'forbidden' };
  if (requireAdmin && !access.isAdmin) return { status: 'forbidden' };
  if (isOnlyEventManager(access) && pathname !== undefined && !eventManagerMayOpen(access, pathname)) {
    return { status: 'forbidden' };
  }
  return { status: 'allowed', access };
};

const managedIds = (access: AdminAccess) => new Set(access.communities.map((c) => c.id));

/** A community-manager sees only its communities; an admin sees all of them. */
export const visibleCommunities = <T extends { id: string }>(access: AdminAccess, communities: T[]) =>
  access.isAdmin ? communities : communities.filter((c) => managedIds(access).has(c.id));

/**
 * A community-manager sees only events of its communities, and (REA-48) a manager the events it
 * manages; an admin sees all of them.
 */
export const visibleEvents = <T extends { id?: string | null; communities?: { id: string }[] | null }>(
  access: AdminAccess,
  events: T[],
) => {
  if (access.isAdmin) return events;
  const ids = managedIds(access);
  const managed = new Set((access.events || []).map((event) => event.id));
  return events.filter(
    (event) =>
      (!!event.id && managed.has(event.id)) || (event.communities || []).some((c) => ids.has(c.id)),
  );
};

export const ROLE_LABELS: Record<string, string> = {
  authenticated: 'Usuário',
  'event-manager': 'Event Manager',
  'community-manager': 'Community Manager',
  admin: 'Admin',
};

export const roleLabel = (type: string | null | undefined) =>
  (type && ROLE_LABELS[type]) || type || '—';
