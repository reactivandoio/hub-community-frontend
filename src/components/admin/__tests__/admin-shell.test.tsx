import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminShell, SIDEBAR_STORAGE_KEY } from '../admin-shell';
import { AdminPageActions } from '../page-actions';
import { useUnsavedChanges } from '../unsaved-guard';

const push = vi.fn();
const signOut = vi.fn();
const setTheme = vi.fn();
let pathname = '/admin';
let isAdmin = true;
let isMobile = false;
let paymentsV2: boolean | null = true;
let eventData: any = undefined;
let lastQueryOptions: any = null;

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => isMobile }));
vi.mock('@/hooks/use-payments-v2', () => ({ usePaymentsV2: () => paymentsV2 }));
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { name: 'Pedro', email: 'pedro@example.com' }, signOut }),
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark', setTheme }) }));
vi.mock('@/components/admin/admin-guard', () => ({
  useAdminAccess: () => ({ isAdmin, isCommunityManager: !isAdmin, canAccessAdmin: true, role: 'x', communities: [] }),
}));
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: (_doc: any, options: any) => {
    lastQueryOptions = options;
    return { data: options?.skip ? undefined : eventData, loading: false };
  },
}));

const renderShell = (children: React.ReactNode = <p>conteúdo da página</p>) =>
  render(<AdminShell>{children}</AdminShell>);

const menu = (name: string) => screen.getByRole('navigation', { name });
const linkNames = (nav: HTMLElement) =>
  within(nav).getAllByRole('link').map((link) => link.textContent);
const breadcrumb = () =>
  within(screen.getByRole('navigation', { name: 'Você está em' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  pathname = '/admin';
  isAdmin = true;
  isMobile = false;
  paymentsV2 = true;
  eventData = undefined;
  lastQueryOptions = null;
});

describe('AdminShell: general sidebar', () => {
  it('shows the page beside the sidebar, under the top bar', () => {
    renderShell();
    expect(screen.getByText('conteúdo da página')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveClass('sticky', 'top-0');
  });

  it.each([
    ['the general sidebar', '/admin/events'],
    ['the event sidebar', '/admin/events/e1'],
  ])('gives the header of %s the height and bottom line of the top bar', (_name, path) => {
    pathname = path;
    renderShell();
    const row = ['h-[--admin-header-height]', 'border-b', 'border-border'];
    expect(screen.getByRole('banner')).toHaveClass(...row);
    expect(screen.getByTestId('sidebar-header')).toHaveClass(...row);
    // The line goes from edge to edge: it is the header's own border, not an inset separator.
    expect(document.querySelector('[data-sidebar="separator"]')).toBeNull();
    // Only one row in the header; the event name comes below the line.
    expect(within(screen.getByTestId('sidebar-header')).getAllByRole('link')).toHaveLength(1);
  });

  it('lists every module to an admin and marks the current one', () => {
    pathname = '/admin/events';
    renderShell();
    expect(linkNames(menu('Menu do admin'))).toEqual([
      'Painel', 'Eventos', 'Comunidades', 'Palestrantes', 'Votações', 'Usuários',
    ]);
    expect(within(menu('Menu do admin')).getByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page');
    expect(within(menu('Menu do admin')).getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current');
  });

  it('hides the admin-only modules from a community-manager', () => {
    isAdmin = false;
    renderShell();
    expect(linkNames(menu('Menu do admin'))).toEqual(['Painel', 'Eventos', 'Comunidades']);
  });

  it('does not ask for an event outside one', () => {
    pathname = '/admin/events/new';
    renderShell();
    expect(lastQueryOptions.skip).toBe(true);
    expect(screen.queryByRole('navigation', { name: 'Menu do evento' })).not.toBeInTheDocument();
  });
});

describe('AdminShell: page actions in the top bar', () => {
  function PageWithActions({ onSave = vi.fn() }: { onSave?: () => void }) {
    return (
      <div data-testid="page-content">
        <p>conteúdo</p>
        <AdminPageActions>
          <button type="button" onClick={onSave}>
            Salvar
          </button>
        </AdminPageActions>
      </div>
    );
  }

  it('shows what the page declares in the top bar, not in the content', () => {
    const onSave = vi.fn();
    renderShell(<PageWithActions onSave={onSave} />);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(screen.getByRole('banner')).toContainElement(button);
    expect(screen.getByTestId('page-content')).not.toContainElement(button);
    // Still the page's own button: its handler runs.
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalled();
  });

  it('a submit button up there still submits the form of the page', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    renderShell(
      <form id="f1" onSubmit={onSubmit}>
        <AdminPageActions>
          <button type="submit" form="f1">
            Salvar Evento
          </button>
        </AdminPageActions>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Evento' }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('has no actions area or menu button on a page without actions', () => {
    renderShell();
    expect(screen.queryByRole('button', { name: 'Ações da página' })).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-page-actions')).toHaveClass('hidden', 'md:hidden');
  });

  it('on the phone keeps them in a menu opened from the top bar', () => {
    renderShell(<PageWithActions />);
    const slot = screen.getByTestId('admin-page-actions');
    const toggle = screen.getByRole('button', { name: 'Ações da página' });
    // Below md the slot is the menu: closed until asked for (from md up it is always shown).
    expect(toggle).toHaveClass('md:hidden');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(slot).toHaveClass('hidden', 'md:flex');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(slot).not.toHaveClass('hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders in place outside the admin shell', () => {
    render(<PageWithActions />);
    expect(screen.getByTestId('page-content')).toContainElement(screen.getByRole('button', { name: 'Salvar' }));
  });
});

describe('AdminShell: signed-in user at the foot of the sidebar', () => {
  const openMenu = () => {
    const trigger = screen.getByRole('button', { name: 'Conta de Pedro' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    return screen.getByRole('menu');
  };

  it('shows who is signed in in the sidebar, and nothing of it in the top bar', () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Conta de Pedro' });
    expect(trigger).toHaveTextContent('Pedro');
    expect(trigger).toHaveTextContent('pedro@example.com');
    expect(screen.getByRole('banner')).not.toContainElement(trigger);
    expect(within(screen.getByRole('banner')).queryByText('Alternar tema')).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).queryByText('Pedro')).not.toBeInTheDocument();
  });

  it('opens the profile menu with profile, theme, the way back to the site and sign out', () => {
    renderShell();
    const menu = openMenu();
    expect(within(menu).getByRole('menuitem', { name: 'Perfil' })).toHaveAttribute('href', '/profile');
    expect(within(menu).getByRole('menuitem', { name: /Usar tema (claro|escuro)/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Voltar para o site' })).toHaveAttribute('href', '/');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sair' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('switches the theme from the menu', () => {
    renderShell();
    fireEvent.click(within(openMenu()).getByRole('menuitem', { name: 'Usar tema claro' }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('keeps the user (the avatar and its menu) when the sidebar is collapsed', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false');
    renderShell();
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument();
    expect(within(openMenu()).getByRole('menuitem', { name: 'Sair' })).toBeInTheDocument();
  });
});

describe('AdminShell: collapsing', () => {
  it('collapses and expands, and remembers the choice', () => {
    renderShell();
    const toggle = screen.getByRole('button', { name: 'Recolher menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('false');
    // Collapsed to icons: the labels stay in the links for screen readers.
    expect(within(menu('Menu do admin')).getByRole('link', { name: 'Eventos' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir menu' }));
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
  });

  it('starts collapsed when it was left collapsed', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false');
    renderShell();
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument();
  });

  it('is a drawer on the phone, opened by the button in the top bar', () => {
    isMobile = true;
    renderShell();
    expect(screen.queryByRole('navigation', { name: 'Menu do admin' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Eventos' })).toBeInTheDocument();
  });
});

describe('AdminShell: event context', () => {
  beforeEach(() => {
    pathname = '/admin/events/e1/programacao';
    eventData = { eventBySlugOrId: { id: 'e1', slug: 'meetup', title: 'Meetup de Outubro' } };
  });

  it('switches the sidebar to the event, with its name and a way back', () => {
    renderShell();
    expect(lastQueryOptions).toMatchObject({ variables: { slugOrId: 'e1' }, skip: false });
    expect(screen.queryByRole('navigation', { name: 'Menu do admin' })).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-event-title')).toHaveTextContent('Meetup de Outubro');
    expect(screen.getByRole('link', { name: 'Voltar para o admin' })).toHaveAttribute('href', '/admin/events');

    const nav = menu('Menu do evento');
    expect(linkNames(nav)).toEqual([
      'Geral', 'Programação', 'Produtos & Lotes', 'Cupons',
      'Analytics', 'Inscrições', 'Presenças', 'Certificados',
      'Check-in', 'Credenciamento', 'Sorteio', 'Página pública',
    ]);
    expect(within(nav).getByRole('link', { name: 'Programação' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Programação' })).toHaveAttribute('href', '/admin/events/e1/programacao');
    expect(within(nav).getByRole('link', { name: 'Geral' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: /Check-in/ })).toHaveAttribute('target', '_blank');
    expect(within(nav).getByRole('link', { name: /Check-in/ })).toHaveAttribute('href', '/checkin/meetup');
  });

  it('hides Cupons from a community-manager', () => {
    isAdmin = false;
    renderShell();
    expect(within(menu('Menu do evento')).queryByRole('link', { name: 'Cupons' })).not.toBeInTheDocument();
  });

  it('shows the route in the breadcrumb, with the event title and clickable levels', () => {
    renderShell();
    expect(breadcrumb()).toEqual(['Admin', 'Eventos', 'Meetup de Outubro', 'Programação']);
    const trail = screen.getByRole('navigation', { name: 'Você está em' });
    expect(within(trail).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    expect(within(trail).getByRole('link', { name: 'Eventos' })).toHaveAttribute('href', '/admin/events');
    expect(within(trail).getByRole('link', { name: 'Meetup de Outubro' })).toHaveAttribute('href', '/admin/events/e1');
    expect(within(trail).getByText('Programação')).toHaveAttribute('aria-current', 'page');
  });

  it('never shows the id while the title loads', () => {
    eventData = undefined;
    renderShell();
    expect(breadcrumb()).toEqual(['Admin', 'Eventos', 'Evento', 'Programação']);
  });
});

describe('AdminShell: unsaved changes', () => {
  // A page with unsaved work: the other sections of the same form keep it.
  function DirtyPage() {
    useUnsavedChanges(true, (href) => href === '/admin/events/e1/produtos');
    return <p>formulário</p>;
  }

  beforeEach(() => {
    pathname = '/admin/events/e1';
    eventData = { eventBySlugOrId: { id: 'e1', slug: 'meetup', title: 'Meetup' } };
  });

  it('asks before leaving through the sidebar, and stays when asked to', () => {
    renderShell(<DirtyPage />);
    const analytics = within(menu('Menu do evento')).getByRole('link', { name: 'Analytics' });
    expect(fireEvent.click(analytics)).toBe(false);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Sair sem salvar?');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('leaves when confirmed', () => {
    renderShell(<DirtyPage />);
    fireEvent.click(within(menu('Menu do evento')).getByRole('link', { name: 'Analytics' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Sair sem salvar' }));
    expect(push).toHaveBeenCalledWith('/admin/events/e1/analytics');
  });

  it('asks on the breadcrumb and on the way back too', () => {
    renderShell(<DirtyPage />);
    expect(fireEvent.click(screen.getByRole('link', { name: 'Voltar para o admin' }))).toBe(false);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Continuar editando' }));
    const trail = screen.getByRole('navigation', { name: 'Você está em' });
    expect(fireEvent.click(within(trail).getByRole('link', { name: 'Eventos' }))).toBe(false);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('does not ask between the sections of the same form', () => {
    renderShell(<DirtyPage />);
    const produtos = within(menu('Menu do evento')).getByRole('link', { name: 'Produtos & Lotes' });
    expect(fireEvent.click(produtos)).toBe(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not ask when nothing changed', () => {
    renderShell();
    expect(fireEvent.click(within(menu('Menu do evento')).getByRole('link', { name: 'Analytics' }))).toBe(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
