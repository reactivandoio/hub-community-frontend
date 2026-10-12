import { describe, expect, it } from 'vitest';

import {
  adminGate,
  isAdminOnlyPath,
  visibleCommunities,
  visibleEvents,
  type AdminAccess,
} from '../admin-access';

const ADMIN: AdminAccess = { role: 'admin', isAdmin: true, isCommunityManager: false, canAccessAdmin: true, communities: [] };
const MANAGER: AdminAccess = {
  role: 'community-manager',
  isAdmin: false,
  isCommunityManager: true,
  canAccessAdmin: true,
  communities: [{ id: 'c-1', title: 'Minha' }],
};
const MEMBER: AdminAccess = { role: 'authenticated', isAdmin: false, isCommunityManager: false, canAccessAdmin: false, communities: [] };

const base = { isHydrated: true, isAuthenticated: true, loading: false, error: false, requireAdmin: false };

describe('adminGate', () => {
  it('waits for the saved session and for the role', () => {
    expect(adminGate({ ...base, isHydrated: false, access: undefined }).status).toBe('checking');
    expect(adminGate({ ...base, loading: true, access: undefined }).status).toBe('checking');
  });

  it('asks whoever is not signed in to log in (on the same page)', () => {
    expect(adminGate({ ...base, isAuthenticated: false, access: undefined })).toEqual({ status: 'login' });
  });

  it('asks to sign in again when the BFF does not accept the token', () => {
    expect(adminGate({ ...base, access: null }).status).toBe('login');
  });

  it('keeps out a user without the role', () => {
    expect(adminGate({ ...base, access: MEMBER }).status).toBe('forbidden');
  });

  it('lets admin and community-manager in, admin-only areas only for admin', () => {
    expect(adminGate({ ...base, access: MANAGER })).toEqual({ status: 'allowed', access: MANAGER });
    expect(adminGate({ ...base, access: MANAGER, requireAdmin: true }).status).toBe('forbidden');
    expect(adminGate({ ...base, access: ADMIN, requireAdmin: true }).status).toBe('allowed');
  });

  it('reports a failure to check', () => {
    expect(adminGate({ ...base, error: true, access: undefined }).status).toBe('error');
  });
});

describe('isAdminOnlyPath', () => {
  it('covers users, speakers and voting sessions, not events', () => {
    expect(isAdminOnlyPath('/admin/usuarios')).toBe(true);
    expect(isAdminOnlyPath('/admin/voting-sessions/new')).toBe(true);
    expect(isAdminOnlyPath('/admin/speakers')).toBe(true);
    expect(isAdminOnlyPath('/admin/events/1')).toBe(false);
    expect(isAdminOnlyPath('/admin')).toBe(false);
    expect(isAdminOnlyPath('/admin/usuarios-x')).toBe(false);
  });
});

describe('scoping', () => {
  const communities = [{ id: 'c-1' }, { id: 'c-2' }];
  const events = [
    { id: 'e1', communities: [{ id: 'c-1' }] },
    { id: 'e2', communities: [{ id: 'c-2' }] },
    { id: 'e3', communities: null },
  ];

  it('gives the admin everything', () => {
    expect(visibleCommunities(ADMIN, communities)).toEqual(communities);
    expect(visibleEvents(ADMIN, events)).toEqual(events);
  });

  it('gives a community-manager only its communities and their events', () => {
    expect(visibleCommunities(MANAGER, communities)).toEqual([{ id: 'c-1' }]);
    expect(visibleEvents(MANAGER, events).map((e) => e.id)).toEqual(['e1']);
  });
});
