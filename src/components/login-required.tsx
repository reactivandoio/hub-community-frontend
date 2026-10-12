'use client';

import { LogIn } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useLoginPrompt } from '@/contexts/login-prompt-context';
import { cn } from '@/lib/utils';

/**
 * "Entre para continuar" (REA-25): what a page that needs a session shows to someone signed
 * out, on its own URL. The login modal opens over it once; whoever closes the modal still has
 * the message and a button to open it again. Render it only after the saved session was read
 * (AuthState.isHydrated), or a signed-in person would see the modal flash.
 */
export function LoginRequired({
  title = 'Entre para continuar',
  description = 'Esta página precisa da sua conta. Entre ou cadastre-se e você continua aqui.',
  reason,
  autoOpen = true,
  className,
  children,
}: {
  title?: string;
  description?: ReactNode;
  /** Under the modal title; defaults to the title. */
  reason?: string;
  autoOpen?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const { requestLogin } = useLoginPrompt();
  const open = () => requestLogin({ reason: reason || title });

  useEffect(() => {
    if (autoOpen) open();
    // Once, when the page turns out to need a login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('min-h-[60vh] flex items-center justify-center px-4 py-16', className)}>
      <div className="w-full max-w-sm text-center" role="region" aria-labelledby="login-required-title">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <LogIn className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
        </div>
        <h1 id="login-required-title" className="text-2xl font-bold text-foreground mb-2">
          {title}
        </h1>
        <div className="text-sm text-muted-foreground mb-8">{description}</div>
        {children}
        <Button onClick={open} className="rounded-full">
          <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
          Entrar
        </Button>
      </div>
    </div>
  );
}
