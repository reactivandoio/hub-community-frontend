'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Loader2, CheckCircle, AlertTriangle, KeyRound } from 'lucide-react';

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

function PasswordCreationContent() {
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
      // We use the resetPassword mutation because creating the initial password 
      // via a 'forgot-password' token uses the same backend logic.
      await resetPassword(code!, password, passwordConfirmation);
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/expired|invalid/i.test(message)) {
        setError(
          'O link de criação de senha expirou ou é inválido. Se você acabou de criar sua conta, tente se cadastrar novamente ou use a opção "Esqueci minha senha".'
        );
      } else {
        setError('Erro ao criar a senha. Tente novamente.');
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
                Este link de criação de senha é inválido ou está incompleto.
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
              <CardTitle>Senha definida com sucesso!</CardTitle>
              <CardDescription>
                Sua conta está ativa e sua senha foi atualizada. Bem-vindo à Hub Community!
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
            <div className="flex justify-center mb-2">
              <div className="bg-primary/10 p-3 rounded-full">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle>Criar sua Senha</CardTitle>
            <CardDescription>
              Defina uma senha segura para acessar sua nova conta na Hub Community.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
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
                    Criando...
                  </>
                ) : (
                  'Criar Senha e Ativar Conta'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

function PasswordCreationFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-12 w-12 mx-auto bg-muted animate-pulse rounded-full mb-2" />
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

export default function PasswordCreationPage() {
  return (
    <Suspense fallback={<PasswordCreationFallback />}>
      <PasswordCreationContent />
    </Suspense>
  );
}
