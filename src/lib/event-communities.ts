import { isOnlyEventManager, type AdminAccess } from './admin-access';

/**
 * REA-55 — an event may belong to several communities. The admin picks any. A community-manager
 * adds only communities it organizes and takes the event out only of those it organizes; the event
 * keeps at least one. An event-manager does not touch them. Same rules as the BFF
 * (`requireOrganizerOfNewCommunities`), which checks them again. Without an access (outside the
 * admin) nothing is restricted here.
 */

const organizes = (access: AdminAccess, communityId: string) =>
  access.communities.some(c => c.id === communityId);

export const canEditEventCommunities = (access: AdminAccess | null) =>
  !access || !isOnlyEventManager(access);

export const canRemoveEventCommunity = (
  access: AdminAccess | null,
  communityId: string,
  selectedIds: string[],
) => {
  if (!access || access.isAdmin) return true;
  if (!canEditEventCommunities(access)) return false;
  return selectedIds.length > 1 && organizes(access, communityId);
};

/** The communities that can still be added: the admin's all, a community-manager's own. */
export const addableEventCommunities = <T extends { id: string }>(
  access: AdminAccess | null,
  all: T[],
  selectedIds: string[],
) => {
  if (!canEditEventCommunities(access)) return [];
  const chosen = new Set(selectedIds);
  return all.filter(c => !chosen.has(c.id) && (!access || access.isAdmin || organizes(access, c.id)));
};

/** Ids of the event's communities, in order, without repeats. */
export const eventCommunityIds = (communities: { id?: string | null }[] | null | undefined) =>
  [...new Set((communities || []).map(c => c?.id).filter((id): id is string => Boolean(id)))];
