'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** The admin has its own frame (sidebar and top bar), not the public site's. */
export const isAdminPath = (pathname: string | null | undefined) =>
  !!pathname && (pathname === '/admin' || pathname.startsWith('/admin/'));

/** Renders the public site's chrome (floating navigation, footer) everywhere but in /admin. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isAdminPath(pathname)) return null;
  return <>{children}</>;
}
