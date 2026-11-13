'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ApolloError } from '@apollo/client';
import { ArrowLeft, KeyRound, Loader2, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import {
  loginCodeSchema,
  loginEmailSchema,
  type LoginCodeFormValues,
  type LoginEmailFormValues,
} from '@/lib/schemas';

interface LoginError {
  message: string;
  code?: string;
  retryAfter?: number;
}

/** The BFF answers in pt-BR with a code (LOGIN_CODE_COOLDOWN, LOGIN_CODE_INVALID…). */
export function loginError(error: unknown, fallback: string): LoginError {
  if (error instanceof ApolloError) {
    const first = error.graphQLErrors?.[0];
    if (first) {
      const ext = (first.extensions || {}) as Record<string, unknown>;
      return {
        message: first.message || fallback,
        code: typeof ext.code === 'string' ? ext.code : undefined,
        retryAfter: typeof ext.retryAfter === 'number' ? ext.retryAfter : undefined,
      };
    }
    if (error.networkError) return { message: 'Erro de conexão. Verifique sua internet.' };
  }
  return { message: fallback };
}

interface AuthModalProps {
  isOpen: boolean;
  /** Closed without signing in (Esc, the X, a click outside). */
  onClose: () => void;
  /** Signed in: the modal closes and the page carries on with the session, no navigation. */
  onSignedIn: () => void;
  /** Why the login is asked for, under the title. */
  reason?: string;
}

/**
 * The login modal, opened over the current page by the LoginPrompt provider (REA-25); pages ask
 * for it with useLoginPrompt, never by rendering it.
 *
 * REA-26: there is no password. The person types the e-mail, gets a 6-digit code and types it
 * back; a new e-mail gets its account at that moment, and the CompleteProfileModal then asks for
 * name, CPF, date of birth, WhatsApp and the 18+ declaration. "Continuar com o Google" comes in a
 * second step, above the e-mail.
 */
export function AuthModal({ isOpen, onClose, onSignedIn, reason }: AuthModalProps) {
  const { requestLoginCode, verifyLoginCode } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const emailForm = useForm<LoginEmailFormValues>({
    resolver: zodResolver(loginEmailSchema),
    defaultValues: { email: '' },
  });

  const codeForm = useForm<LoginCodeFormValues>({
    resolver: zodResolver(loginCodeSchema),
    defaultValues: { code: '' },
  });

  // Counts down the seconds before another code can be asked for.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async (address: string) => {
    setSending(true);
    try {
      const { resendIn: wait } = await requestLoginCode(address);
      setEmail(address.trim().toLowerCase());
      setResendIn(wait);
      setStep('code');
      codeForm.reset({ code: '' });
      return true;
    } catch (error) {
      const failure = loginError(error, 'Não conseguimos enviar o código. Tente novamente.');
      if (failure.retryAfter) setResendIn(failure.retryAfter);
      // A code sent a moment ago is still valid: go on to type it.
      if (failure.code === 'LOGIN_CODE_COOLDOWN') {
        setEmail(address.trim().toLowerCase());
        setStep('code');
      }
      toast.error(failure.message);
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleEmail = async (data: LoginEmailFormValues) => {
    await sendCode(data.email);
  };

  const handleResend = async () => {
    if (await sendCode(email)) toast.success('Enviamos um novo código.');
  };

  const handleCode = async (data: LoginCodeFormValues) => {
    setVerifying(true);
    try {
      await verifyLoginCode(email, data.code);
      toast.success('Você entrou!');
      reset();
      onSignedIn();
    } catch (error) {
      const failure = loginError(error, 'Não foi possível entrar. Tente novamente.');
      codeForm.setError('code', { message: failure.message });
      if (failure.code === 'LOGIN_CODE_EXPIRED') codeForm.setValue('code', '');
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => {
    setStep('email');
    setEmail('');
    emailForm.reset();
    codeForm.reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Entrar na sua conta</DialogTitle>
          <DialogDescription>
            {reason || 'Entre ou crie sua conta com seu e-mail, sem senha.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'email' ? (
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(handleEmail)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seu e-mail</FormLabel>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="seu@email.com"
                          className="pl-10"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-sm text-muted-foreground">
                Enviamos um código de acesso para o seu e-mail. Primeira vez no Hub? Sua conta é
                criada quando você confirmar o código.
              </p>
              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Receber código'
                )}
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...codeForm}>
            <form onSubmit={codeForm.handleSubmit(handleCode)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enviamos um código de 6 números para <strong className="text-foreground">{email}</strong>.
                Ele vale por 10 minutos. Confira também a caixa de spam.
              </p>
              <FormField
                control={codeForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="000000"
                          maxLength={7}
                          className="pl-10 tracking-[0.3em]"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={verifying}>
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Usar outro e-mail
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={sending || resendIn > 0}
                  className="text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                >
                  {resendIn > 0 ? `Reenviar em ${resendIn}s` : 'Reenviar código'}
                </button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
