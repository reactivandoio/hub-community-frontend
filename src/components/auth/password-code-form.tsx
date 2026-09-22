'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

import { FadeIn } from '@/components/animations/fade-in';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';

export interface PasswordCodeCopy {
  title: string;
  description: string;
  submitLabel: string;
  submittingLabel: string;
  successTitle: string;
  successDescription: string;
  invalidLinkDescription: string;
  expiredMessage: string;
  genericErrorMessage: string;
}

export const RESET_PASSWORD_COPY: PasswordCodeCopy = {
  title: 'Redefinir Senha',
  description: 'Digite sua nova senha abaixo',
  submitLabel: 'Redefinir Senha',
  submittingLabel: 'Redefinindo...',
  successTitle: 'Senha redefinida com sucesso!',
  successDescription:
    'Sua senha foi alterada. Agora você pode fazer login com a nova senha.',
  invalidLinkDescription:
    'Este link de redefinição de senha é inválido ou está incompleto.',
  expiredMessage:
    'O link de redefinição expirou. Solicite um novo link de recuperação de senha.',
  genericErrorMessage: 'Erro ao redefinir a senha. Tente novamente.',
};

export const CREATE_PASSWORD_COPY: PasswordCodeCopy = {
  title: 'Crie sua senha',
  description:
    'Boas-vindas! Sua inscrição já está feita. Crie uma senha para acessar sua conta.',
  submitLabel: 'Criar senha',
  submittingLabel: 'Criando...',
  successTitle: 'Senha criada com sucesso!',
  successDescription: 'Sua conta está pronta. Agora você pode fazer login com sua senha.',
  invalidLinkDescription:
    'Este link para criar sua senha é inválido ou está incompleto.',
  expiredMessage:
    'Este link expirou ou já foi usado. Use "Esqueci minha senha" no login para receber um novo.',
  genericErrorMessage: 'Erro ao criar a senha. Tente novamente.',
};

function PasswordCodeContent({ copy }: { copy: PasswordCodeCopy }) {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const { resetPassword } = useAuth();

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (password !== passwordConfirmation) {
      setError('As senhas não coincidem');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(code!, password, passwordConfirmation);
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/expired|invalid|incorrect/i.test(message)) {
        setError(copy.expiredMessage);
      } else {
        setError(copy.genericErrorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // No code param — invalid link
  if (!code) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <FadeIn direction="up" duration={0.3}>
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
              </div>
              <CardTitle>Link inválido</CardTitle>
              <CardDescription>
                {copy.invalidLinkDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/">Voltar para a página inicial</Link>
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <FadeIn direction="up" duration={0.3}>
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-12 w-12 text-emerald-500" />
              </div>
              <CardTitle>{copy.successTitle}</CardTitle>
              <CardDescription>
                {copy.successDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/?login=true">Fazer Login</Link>
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <FadeIn direction="up" duration={0.3}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passwordConfirmation">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="passwordConfirmation"
                    type="password"
                    placeholder="Repita a senha"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    className="pl-10"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {copy.submittingLabel}
                  </>
                ) : (
                  copy.submitLabel
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

function PasswordCodeFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-7 w-48 mx-auto bg-muted animate-pulse rounded" />
          <div className="h-5 w-64 mx-auto bg-muted animate-pulse rounded mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-10 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    </div>
  );
}

/** Password form driven by a `?code=` link: reset password and first password. */
export function PasswordCodeForm({ copy }: { copy: PasswordCodeCopy }) {
  return (
    <Suspense fallback={<PasswordCodeFallback />}>
      <PasswordCodeContent copy={copy} />
    </Suspense>
  );
}
