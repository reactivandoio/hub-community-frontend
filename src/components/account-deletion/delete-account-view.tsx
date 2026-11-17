'use client';

import { useMutation, useQuery } from '@apollo/client';
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

import { loginError } from '@/components/auth-modal';
import { LoginRequired } from '@/components/login-required';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import {
  DELETED_DATA,
  KEPT_DATA,
  formatEventDate,
  signupsLostOnDeletion,
  type MySignup,
  type RetentionItem,
} from '@/lib/account-deletion';
import { DELETE_MY_ACCOUNT, MY_SIGNUPS } from '@/lib/queries';

interface DeleteMyAccountResponse {
  deleteMyAccount: { success: boolean; message?: string | null };
}

const RetentionList = ({ title, items }: { title: string; items: RetentionItem[] }) => (
  <section className="rounded-2xl border border-border/50 bg-card p-6">
    <h2 className="mb-4 text-lg font-semibold text-foreground">{title}</h2>
    <ul className="space-y-3 text-sm text-muted-foreground">
      {items.map(item => (
        <li key={item.what}>
          <strong className="text-foreground">{item.what}.</strong> {item.happens}
        </li>
      ))}
    </ul>
  </section>
);

const Explanation = () => (
  <div className="space-y-6">
    <RetentionList title="O que é apagado" items={DELETED_DATA} />
    <RetentionList title="O que fica, e por quê" items={KEPT_DATA} />
    <p className="text-sm text-muted-foreground">
      Inscrições em eventos que ainda não aconteceram deixam de valer, e não há reembolso automático
      de ingressos pagos. A exclusão não pode ser desfeita. Saiba mais na{' '}
      <Link href="/privacy" className="font-medium text-primary hover:underline">
        Política de Privacidade
      </Link>
      .
    </p>
  </div>
);

/** The signups whose ticket stops being valid; nothing while `mySignups` is unavailable. */
function LostSignups() {
  const { data, error } = useQuery<{ mySignups: MySignup[] }>(MY_SIGNUPS, {
    fetchPolicy: 'network-only',
  });
  if (error || !data) return null;
  const lost = signupsLostOnDeletion(data.mySignups);
  if (lost.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6"
      aria-labelledby="lost-signups-title"
    >
      <h2 id="lost-signups-title" className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
        Estas inscrições deixam de valer
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        O ingresso destes eventos fica sem efeito e não há reembolso automático.
      </p>
      <ul className="space-y-2 text-sm">
        {lost.map(signup => {
          const date = formatEventDate(signup.event.start_date);
          return (
            <li key={signup.id} className="text-foreground">
              <strong>{signup.event.title || 'Evento'}</strong>
              {date && <span className="text-muted-foreground"> — {date}</span>}
              {signup.product_name && <span className="text-muted-foreground"> ({signup.product_name})</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * REA-65: `/excluir-conta`, the web link Google Play asks for. Explains what is deleted and what is
 * kept (spec REA-58 §5), asks for the login in place (REA-25), sends a fresh code to the account's
 * e-mail (REA-26) and deletes the account with it (`deleteMyAccount`); then signs out.
 */
export function DeleteAccountView() {
  const { isAuthenticated, isHydrated, user, requestLoginCode, signOut } = useAuth();
  const [deleteMyAccount] = useMutation<DeleteMyAccountResponse>(DELETE_MY_ACCOUNT);

  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [code, setCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const email = user?.email || '';

  const sendCode = async () => {
    if (!email) return;
    setSending(true);
    setError(null);
    try {
      const { resendIn: wait } = await requestLoginCode(email);
      setResendIn(wait);
      setCodeSent(true);
      setCode('');
    } catch (err) {
      const failure = loginError(err, 'Não conseguimos enviar o código. Tente novamente.');
      if (failure.retryAfter) setResendIn(failure.retryAfter);
      // A code sent a moment ago is still valid: go on to type it.
      if (failure.code === 'LOGIN_CODE_COOLDOWN') setCodeSent(true);
      setError(failure.message);
    } finally {
      setSending(false);
    }
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) {
      setError('Digite os 6 números do código.');
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const { data } = await deleteMyAccount({ variables: { code: digits } });
      if (!data?.deleteMyAccount?.success) {
        setError(data?.deleteMyAccount?.message || 'Não foi possível excluir a conta. Tente novamente.');
        return;
      }
      signOut();
      setDeleted(true);
    } catch (err) {
      const failure = loginError(err, 'Não foi possível excluir a conta. Tente novamente.');
      if (failure.code === 'LOGIN_CODE_EXPIRED') setCode('');
      setError(failure.message);
    } finally {
      setDeleting(false);
    }
  };

  let body: React.ReactNode;
  if (deleted) {
    body = (
      <div className="py-8 text-center" role="status">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" aria-hidden="true" />
        <h2 className="mb-2 text-2xl font-bold text-foreground">Conta excluída</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Seus dados pessoais foram apagados e você saiu da conta. Obrigado por ter feito parte do Hub.
        </p>
        <Button asChild className="rounded-full">
          <Link href="/">Ir para o início</Link>
        </Button>
      </div>
    );
  } else if (!isHydrated) {
    body = (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Carregando" />
      </div>
    );
  } else if (!isAuthenticated) {
    body = (
      <>
        <Explanation />
        <LoginRequired
          title="Entre para excluir sua conta"
          reason="Entre com a conta que você quer excluir"
          description="Para excluir a conta, entre com o e-mail dela. Você recebe um código de acesso, sem senha."
          className="min-h-0 py-10"
        />
      </>
    );
  } else {
    body = (
      <div className="space-y-6">
        <Explanation />
        <LostSignups />
        <section className="rounded-2xl border border-border/50 bg-card p-6" aria-labelledby="confirm-title">
          <h2 id="confirm-title" className="mb-2 text-lg font-semibold text-foreground">
            Confirmar a exclusão
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Para confirmar que é você, enviamos um código novo para{' '}
            <strong className="text-foreground">{email}</strong>.
          </p>

          {!codeSent ? (
            <Button onClick={sendCode} disabled={sending || !email} className="rounded-full">
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Enviar código
            </Button>
          ) : (
            <form onSubmit={confirm} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="delete-account-code">Código</Label>
                <Input
                  id="delete-account-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={7}
                  className="max-w-[12rem] tracking-[0.3em]"
                  value={code}
                  onChange={event => setCode(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'delete-account-error' : undefined}
                />
                <p className="text-xs text-muted-foreground">
                  O código vale por 10 minutos. Confira também a caixa de spam.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="destructive" disabled={deleting} className="rounded-full">
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Excluir minha conta
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={sendCode}
                  disabled={sending || resendIn > 0}
                  className="rounded-full"
                >
                  {resendIn > 0 ? `Reenviar em ${resendIn}s` : 'Reenviar código'}
                </Button>
              </div>
            </form>
          )}

          {error && (
            <p id="delete-account-error" role="alert" className="mt-4 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto px-4 pb-8 pt-24">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">Excluir sua conta</h1>
            </div>
            <p className="max-w-xl leading-relaxed text-muted-foreground sm:ml-[52px]">
              Aqui você exclui a sua conta do Hub Community, do site ou do app.
            </p>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">{body}</div>
      </div>
    </div>
  );
}
