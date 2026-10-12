/**
 * Who may use the Hub admin (REA-10). Pure rules, shared by AdminGuard and the admin pages.
 *
 * The real protection is the BFF: every admin operation checks the role on the server. This
 * only decides what the browser shows, so nobody lands on a screen whose calls would fail.
 * - admin: everything, including users and roles.
 * - community-manager: /admin, check-in, badge printing and the raffle, scoped to the
 *   communities it organizes and their events.
 * - anyone else: no access. Not signed in: the login modal opens on the same page (REA-25).
 */

export type AdminRoleType = 'authenticated' | 'community-manager' | 'admin';

export interface AdminCommunityRef {
  id: string;
  title?: string | null;
  slug?: string | null;
}

export interface AdminAccess {
  role: AdminRoleType | string | null;
  isAdmin: boolean;
  isCommunityManager: boolean;
  canAccessAdmin: boolean;
  communities: AdminCommunityRef[];
}

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
}: {
  isHydrated: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  error: boolean;
  access: AdminAccess | null | undefined;
  requireAdmin: boolean;
}): AdminGateState => {
  if (!isHydrated) return { status: 'checking' };
  if (!isAuthenticated) return { status: 'login' };
  if (loading && !access) return { status: 'checking' };
  if (error && !access) return { status: 'error' };
  // A token the BFF does not accept (expired, revoked) comes back as null: sign in again.
  if (!access) return { status: 'login' };
  if (!access.canAccessAdmin) return { status: 'forbidden' };
  if (requireAdmin && !access.isAdmin) return { status: 'forbidden' };
  return { status: 'allowed', access };
};

const managedIds = (access: AdminAccess) => new Set(access.communities.map((c) => c.id));

/** A community-manager sees only its communities; an admin sees all of them. */
export const visibleCommunities = <T extends { id: string }>(access: AdminAccess, communities: T[]) =>
  access.isAdmin ? communities : communities.filter((c) => managedIds(access).has(c.id));

/** A community-manager sees only events of its communities; an admin sees all of them. */
export const visibleEvents = <T extends { communities?: { id: string }[] | null }>(
  access: AdminAccess,
  events: T[],
) => {
  if (access.isAdmin) return events;
  const ids = managedIds(access);
  return events.filter((event) => (event.communities || []).some((c) => ids.has(c.id)));
};

export const ROLE_LABELS: Record<string, string> = {
  authenticated: 'Usuário',
  'community-manager': 'Community Manager',
  admin: 'Admin',
};

export const roleLabel = (type: string | null | undefined) =>
  (type && ROLE_LABELS[type]) || type || '—';
