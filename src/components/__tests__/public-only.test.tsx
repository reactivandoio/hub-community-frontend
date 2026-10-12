import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PublicOnly, isAdminPath } from '../public-only';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const renderAt = (path: string) => {
  pathname = path;
  return render(
    <PublicOnly>
      <nav>barra flutuante</nav>
    </PublicOnly>,
  );
};

describe('PublicOnly (REA-24)', () => {
  it.each(['/admin', '/admin/events', '/admin/events/e1/programacao', '/admin/usuarios'])(
    'hides the public navigation on %s',
    (path) => {
      renderAt(path);
      expect(screen.queryByText('barra flutuante')).not.toBeInTheDocument();
    },
  );

  it.each(['/', '/events', '/communities/x', '/checkin/meetup', '/administracao'])(
    'keeps the public navigation on %s',
    (path) => {
      renderAt(path);
      expect(screen.getByText('barra flutuante')).toBeInTheDocument();
    },
  );

  it('isAdminPath only matches /admin and what is below it', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/events')).toBe(true);
    expect(isAdminPath('/administracao')).toBe(false);
    expect(isAdminPath(null)).toBe(false);
  });
});
