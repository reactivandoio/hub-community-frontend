'use client';

import { useQuery } from '@apollo/client';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, type ReactNode } from 'react';

import { LoginRequired } from '@/components/login-required';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { adminGate, isAdminOnlyPath, type AdminAccess } from '@/lib/admin-access';
import { ADMIN_ACCESS } from '@/lib/queries';

const AdminAccessContext = createContext<AdminAccess | null>(null);

/** The access when rendered inside an AdminGuard, null elsewhere (e.g. a form in a test). */
export function useOptionalAdminAccess(): AdminAccess | null {
  return useContext(AdminAccessContext);
}

/** The signed-in user's access, inside an AdminGuard. */
export function useAdminAccess(): AdminAccess {
  const access = useContext(AdminAccessContext);
  if (!access) throw new Error('useAdminAccess must be used inside <AdminGuard>');
  return access;
}

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">{children}</div>
  );
}

function Checking() {
  return (
    <FullScreen>
      <div
        role="status"
        aria-label="Verificando acesso"
        className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"
      />
    </FullScreen>
  );
}

function Blocked({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  return (
    <FullScreen>
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">{text}</p>
        <div className="flex justify-center gap-2">
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Tentar de novo
            </Button>
          )}
          <Button asChild>
            <Link href="/">Voltar para o início</Link>
          </Button>
        </div>
      </div>
    </FullScreen>
  );
}

/**
 * Lets in only who is signed in with the admin or community-manager role (admin only for the
 * paths in ADMIN_ONLY_PATHS, or with `requireAdmin`). The role comes from the BFF, which checks
 * it again on every operation; this guard only keeps people off screens they cannot use.
 */
export function AdminGuard({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { isAuthenticated, isHydrated, signOut } = useAuth();
  const pathname = usePathname() || '/admin';

  const { data, loading, error, refetch } = useQuery<{ adminAccess: AdminAccess | null }>(
    ADMIN_ACCESS,
    { skip: !isHydrated || !isAuthenticated, fetchPolicy: 'network-only' },
  );

  const gate = adminGate({
    isHydrated: !!isHydrated,
    isAuthenticated,
    loading,
    error: !!error,
    access: data?.adminAccess,
    requireAdmin: requireAdmin || isAdminOnlyPath(pathname),
  });

  // A saved token the BFF no longer accepts (expired, revoked): drop it and ask for a login.
  const tokenRejected = gate.status === 'login' && isAuthenticated;
  useEffect(() => {
    if (tokenRejected) signOut();
  }, [tokenRejected, signOut]);

  switch (gate.status) {
    case 'login':
      // Same URL, modal over it (REA-25); nothing of the admin is fetched before the session.
      return tokenRejected ? (
        <Checking />
      ) : (
        <LoginRequired
          title="Entre para continuar"
          description="Esta área é para quem organiza comunidades e eventos no Hub. Entre com a sua conta para continuar."
          reason="Entre para acessar a área de organização"
        />
      );
    case 'allowed':
      return <AdminAccessContext.Provider value={gate.access}>{children}</AdminAccessContext.Provider>;
    case 'forbidden':
      return (
        <Blocked
          title="Sem acesso"
          text="Sua conta não tem permissão para esta área. Se você organiza uma comunidade, peça a um admin do Hub para liberar o seu acesso."
        />
      );
    case 'error':
      return (
        <Blocked
          title="Não foi possível verificar seu acesso"
          text="Confira sua conexão e tente de novo."
          onRetry={() => refetch()}
        />
      );
    default:
      return <Checking />;
  }
}
