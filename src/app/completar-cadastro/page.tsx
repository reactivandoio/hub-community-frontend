'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { LoginRequired } from '@/components/login-required';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { missingCertificateFields } from '@/lib/profile-completeness';

/**
 * REA-36: the link of the "informe sua data de nascimento" e-mail. Signed in, the
 * CompleteProfileModal (root layout) opens by itself while anything is missing; this page only
 * says when the data is complete. Signed out, the login opens here.
 */
export default function CompletarCadastroPage() {
  const { user, isAuthenticated, isHydrated } = useAuth();

  if (!isHydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Carregando" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <LoginRequired
        title="Atualize seus dados"
        reason="Entre para informar sua data de nascimento"
        description="Entre na sua conta para informar sua data de nascimento e manter sua conta ativa."
      />
    );
  }

  const complete = missingCertificateFields(user).length === 0;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        {complete ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Seus dados estão completos</h1>
            <p className="text-sm text-muted-foreground mb-8">Obrigado! Sua conta continua ativa.</p>
            <Button asChild className="rounded-full">
              <Link href="/">Ir para o início</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">Atualize seus dados</h1>
            <p className="text-sm text-muted-foreground">Preencha os dados que faltam na janela aberta.</p>
          </>
        )}
      </div>
    </div>
  );
}
