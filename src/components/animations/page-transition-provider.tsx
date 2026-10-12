'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';

import { isAdminPath } from '@/components/public-only';

interface PageTransitionProviderProps {
  children: React.ReactNode;
}

export function PageTransitionProvider({
  children,
}: PageTransitionProviderProps) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  // The admin keeps its frame mounted between pages (sidebar, and the event form across its
  // sections); a wrapper keyed by the path would remount all of it on every navigation.
  if (shouldReduceMotion || isAdminPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
