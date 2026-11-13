/**
 * REA-48 — does a user's role match what they are linked to? Pure, for /admin/usuarios.
 *
 * The role alone grants nothing: a community-manager acts only on the communities it organizes,
 * an event-manager only on the events it manages. And being listed grants nothing without the
 * role. These are the cases where the two do not match.
 */
export function accessMismatch(
  roleType: string | null | undefined,
  communities: number,
  events: number
): string | null {
  switch (roleType) {
    case 'admin':
      return null;
    case 'community-manager':
      if (communities > 0) return null;
      return events > 0
        ? 'Community Manager sem comunidade: só vê os eventos que gere.'
        : 'Community Manager sem comunidade nem evento: não vê nada no admin.';
    case 'event-manager':
      if (communities > 0) {
        return 'Organiza comunidade, mas o papel Event Manager não dá acesso a ela: mude para Community Manager.';
      }
      return events > 0 ? null : 'Event Manager sem evento: não vê nada no admin.';
    default:
      if (communities > 0) {
        return 'Está como organizador, mas o papel Usuário não dá acesso: mude para Community Manager.';
      }
      if (events > 0) {
        return 'Está como gestor de evento, mas o papel Usuário não dá acesso: mude para Event Manager.';
      }
      return null;
  }
}
