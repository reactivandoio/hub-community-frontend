import { describe, expect, it } from 'vitest';

import {
  adminBreadcrumbs,
  eventFormSection,
  eventIdFromPath,
  eventNavGroups,
  eventSectionHref,
  isNavItemActive,
  legacyEventHashHref,
  mainNavItems,
} from '../admin-nav';

const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe('mainNavItems', () => {
  it('shows every module to an admin', () => {
    expect(labels(mainNavItems({ isAdmin: true }))).toEqual([
      'Painel', 'Eventos', 'Comunidades', 'Palestrantes', 'Votações', 'Usuários',
    ]);
  });

  it('hides the admin-only modules from a community-manager', () => {
    expect(labels(mainNavItems({ isAdmin: false }))).toEqual(['Painel', 'Eventos', 'Comunidades']);
  });
});

describe('eventIdFromPath', () => {
  it('finds the event on its page and below it', () => {
    expect(eventIdFromPath('/admin/events/abc123')).toBe('abc123');
    expect(eventIdFromPath('/admin/events/abc123/analytics')).toBe('abc123');
  });

  it('is null outside an event, the list and the new-event page included', () => {
    expect(eventIdFromPath('/admin')).toBeNull();
    expect(eventIdFromPath('/admin/events')).toBeNull();
    expect(eventIdFromPath('/admin/events/new')).toBeNull();
    expect(eventIdFromPath('/admin/communities')).toBeNull();
    expect(eventIdFromPath(null)).toBeNull();
  });
});

describe('event form sections', () => {
  it('gives each part of the form its own URL', () => {
    expect(eventSectionHref('e1', 'general')).toBe('/admin/events/e1');
    expect(eventSectionHref('e1', 'schedule')).toBe('/admin/events/e1/programacao');
    expect(eventSectionHref('e1', 'products')).toBe('/admin/events/e1/produtos');
  });

  it('reads the part back from the path', () => {
    expect(eventFormSection('/admin/events/e1')).toBe('general');
    expect(eventFormSection('/admin/events/e1/')).toBe('general');
    expect(eventFormSection('/admin/events/e1/programacao')).toBe('schedule');
    expect(eventFormSection('/admin/events/e1/produtos')).toBe('products');
  });

  it('is null for pages that are not the form', () => {
    expect(eventFormSection('/admin/events/e1/cupons')).toBeNull();
    expect(eventFormSection('/admin/events/e1/analytics')).toBeNull();
    expect(eventFormSection('/admin/events/new')).toBeNull();
    expect(eventFormSection('/admin/events')).toBeNull();
  });

  it('sends the old fragment links to the new URLs', () => {
    expect(legacyEventHashHref('e1', '#schedule')).toBe('/admin/events/e1/programacao');
    expect(legacyEventHashHref('e1', '#products')).toBe('/admin/events/e1/produtos');
    expect(legacyEventHashHref('e1', '#general')).toBe('/admin/events/e1');
    expect(legacyEventHashHref('e1', '')).toBeNull();
    expect(legacyEventHashHref('e1', '#cupom=ABC')).toBeNull();
  });
});

describe('eventNavGroups', () => {
  const groups = (overrides = {}) =>
    eventNavGroups({ id: 'e1', slug: 'meetup', isAdmin: true, paymentsV2: true, ...overrides });
  const all = (overrides = {}) => groups(overrides).flatMap((group) => group.items);

  it('lists the sections of the event, each with its own URL', () => {
    expect(groups().map((group) => group.label)).toEqual(['Edição', 'Acompanhamento', 'Ferramentas']);
    expect(all().map((item) => [item.label, item.href])).toEqual([
      ['Geral', '/admin/events/e1'],
      ['Programação', '/admin/events/e1/programacao'],
      ['Produtos & Lotes', '/admin/events/e1/produtos'],
      ['Cupons', '/admin/events/e1/cupons'],
      ['Analytics', '/admin/events/e1/analytics'],
      ['Inscrições', '/admin/events/e1/import-signups'],
      ['Presenças', '/admin/events/e1/attendance'],
      ['Certificados', '/admin/events/e1/certificados'],
      ['Check-in', '/checkin/meetup'],
      ['Credenciamento', '/badge-printer/event/meetup'],
      ['Sorteio', '/sorteio?event=meetup'],
      ['Página pública', '/events/meetup'],
    ]);
    expect(new Set(all().map((item) => item.href)).size).toBe(all().length);
  });

  it('keeps coupons for the admin, and only with the payment API', () => {
    expect(labels(all({ isAdmin: false }))).not.toContain('Cupons');
    expect(labels(all({ paymentsV2: false }))).not.toContain('Cupons');
    expect(labels(all({ paymentsV2: null }))).not.toContain('Cupons');
  });

  it('opens the tools that live outside the admin in a new tab', () => {
    expect(all().filter((item) => item.external).map((item) => item.label)).toEqual([
      'Check-in', 'Credenciamento', 'Sorteio', 'Página pública',
    ]);
  });

  it('falls back to the id while the slug is not known', () => {
    expect(all({ slug: null }).find((item) => item.label === 'Check-in')?.href).toBe('/checkin/e1');
  });
});

describe('isNavItemActive', () => {
  const [painel, eventos] = mainNavItems({ isAdmin: true });
  const [geral, programacao] = eventNavGroups({ id: 'e1', isAdmin: true, paymentsV2: true })[0].items;

  it('marks the module of the current page', () => {
    expect(isNavItemActive('/admin/events', eventos)).toBe(true);
    expect(isNavItemActive('/admin/events/new', eventos)).toBe(true);
    expect(isNavItemActive('/admin/communities', eventos)).toBe(false);
  });

  it('marks the exact items only on their own page', () => {
    expect(isNavItemActive('/admin', painel)).toBe(true);
    expect(isNavItemActive('/admin/events', painel)).toBe(false);
    expect(isNavItemActive('/admin/events/e1', geral)).toBe(true);
    expect(isNavItemActive('/admin/events/e1/programacao', geral)).toBe(false);
    expect(isNavItemActive('/admin/events/e1/programacao', programacao)).toBe(true);
  });
});

describe('adminBreadcrumbs', () => {
  const trail = (path: string, eventTitle?: string) =>
    adminBreadcrumbs(path, { eventTitle }).map((crumb) => crumb.label);

  it('names the general pages', () => {
    expect(trail('/admin')).toEqual(['Admin']);
    expect(trail('/admin/events')).toEqual(['Admin', 'Eventos']);
    expect(trail('/admin/events/new')).toEqual(['Admin', 'Eventos', 'Novo evento']);
    expect(trail('/admin/communities')).toEqual(['Admin', 'Comunidades']);
    expect(trail('/admin/speakers')).toEqual(['Admin', 'Palestrantes']);
    expect(trail('/admin/usuarios')).toEqual(['Admin', 'Usuários']);
    expect(trail('/admin/voting-sessions')).toEqual(['Admin', 'Votações']);
    expect(trail('/admin/voting-sessions/new')).toEqual(['Admin', 'Votações', 'Nova sessão']);
    expect(trail('/admin/voting-sessions/xyz')).toEqual(['Admin', 'Votações', 'Editar sessão']);
  });

  it('shows the event title, never its id, and the section', () => {
    expect(trail('/admin/events/e1', 'Meetup de Outubro')).toEqual(['Admin', 'Eventos', 'Meetup de Outubro', 'Geral']);
    expect(trail('/admin/events/e1/programacao', 'Meetup de Outubro')).toEqual([
      'Admin', 'Eventos', 'Meetup de Outubro', 'Programação',
    ]);
    expect(trail('/admin/events/e1/produtos', 'Meetup')).toContain('Produtos & Lotes');
    expect(trail('/admin/events/e1/cupons', 'Meetup')).toContain('Cupons');
    expect(trail('/admin/events/e1/analytics', 'Meetup')).toContain('Analytics');
    expect(trail('/admin/events/e1/import-signups', 'Meetup')).toContain('Inscrições');
    expect(trail('/admin/events/e1/attendance', 'Meetup')).toContain('Presenças');
    expect(trail('/admin/events/e1/certificados', 'Meetup')).toContain('Certificados');
  });

  it('says "Evento" while the title is loading', () => {
    expect(trail('/admin/events/e1/analytics')).toEqual(['Admin', 'Eventos', 'Evento', 'Analytics']);
    expect(trail('/admin/events/e1/analytics').join(' ')).not.toContain('e1');
  });

  it('gives every level a URL of its own', () => {
    expect(adminBreadcrumbs('/admin/events/e1/analytics', { eventTitle: 'Meetup' }).map((c) => c.href)).toEqual([
      '/admin', '/admin/events', '/admin/events/e1', '/admin/events/e1/analytics',
    ]);
  });
});
