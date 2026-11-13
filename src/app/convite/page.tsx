'use client';

import { useMutation, useQuery } from '@apollo/client';
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { LoginRequired } from '@/components/login-required';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useLoginPrompt } from '@/contexts/login-prompt-context';
import {
  inviteClosedMessage,
  inviteDestination,
  inviteWhat,
  type ManagementInviteAcceptance,
  type ManagementInvitePreview,
} from '@/lib/management-invite';
import { ACCEPT_MANAGEMENT_INVITE, MANAGEMENT_INVITE } from '@/lib/queries';

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
    <div className="w-full max-w-md text-center">{children}</div>
  </div>
);

const errorMessage = (err: unknown) =>
  (err as { graphQLErrors?: { message?: string }[] })?.graphQLErrors?.[0]?.message ||
  'Não foi possível aceitar o convite. Tente de novo.';

/**
 * REA-48: the link of the invite e-mail (`/convite?t=…`). Signed out, the login by code opens here
 * — and that login already turns the invite into access. Signed in, the invite is accepted (it
 * only works with the invited e-mail) and the person goes to the admin.
 */
function InviteContent() {
  const token = useSearchParams()?.get('t') || '';
  const router = useRouter();
  const { isAuthenticated, isHydrated, signOut } = useAuth();
  const { requestLogin } = useLoginPrompt();

  const { data, loading } = useQuery<{ managementInvite: ManagementInvitePreview | null }>(
    MANAGEMENT_INVITE,
    { variables: { token }, skip: !token, fetchPolicy: 'network-only' }
  );
  const [accept] = useMutation<{ acceptManagementInvite: ManagementInviteAcceptance }>(
    ACCEPT_MANAGEMENT_INVITE
  );
  const [accepted, setAccepted] = useState<ManagementInviteAcceptance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  const invite = data?.managementInvite;

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !token || tried.current) return;
    // Wait for the preview: a closed invite is only explained, never sent.
    if (loading || !invite) return;
    if (invite.status !== 'pending' && invite.status !== 'accepted') return;
    tried.current = true;
    accept({ variables: { token } })
      .then(({ data: result }) => {
        const acceptance = result?.acceptManagementInvite;
        if (!acceptance) return;
        setAccepted(acceptance);
        router.replace(inviteDestination(acceptance));
      })
      .catch(err => setError(errorMessage(err)));
  }, [isHydrated, isAuthenticated, token, loading, invite, accept, router]);

  if (!token) {
    return (
      <Centered>
        <h1 className="mb-2 text-2xl font-bold">Link incompleto</h1>
        <p className="text-sm text-muted-foreground">Abra o link do e-mail do convite de novo.</p>
      </Centered>
    );
  }

  if (!isHydrated || (loading && !data)) {
    return (
      <Centered>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-label="Carregando" />
      </Centered>
    );
  }

  if (!invite) {
    return (
      <Centered>
        <h1 className="mb-2 text-2xl font-bold">Convite não encontrado</h1>
        <p className="text-sm text-muted-foreground">Confira o link do e-mail ou peça um novo convite.</p>
      </Centered>
    );
  }

  const closed = invite.status === 'accepted' ? null : inviteClosedMessage(invite.status);
  if (closed) {
    return (
      <Centered>
        <MailWarning className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mb-2 text-2xl font-bold">Convite para {inviteWhat(invite)}</h1>
        <p className="text-sm text-muted-foreground">{closed}</p>
      </Centered>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginRequired
        title={`Convite para ${inviteWhat(invite)}`}
        reason={`Entre com ${invite.maskedEmail} para aceitar o convite`}
        description={`O convite é para o e-mail ${invite.maskedEmail}. Entre com ele: você recebe um código de acesso, sem senha, e a conta é criada se ainda não existir.`}
      />
    );
  }

  if (error) {
    return (
      <Centered>
        <MailWarning className="mx-auto mb-4 h-12 w-12 text-destructive" aria-hidden="true" />
        <h1 className="mb-2 text-2xl font-bold">Convite para {inviteWhat(invite)}</h1>
        <p className="mb-6 text-sm text-muted-foreground" role="alert">
          {error}
        </p>
        <Button
          className="rounded-full"
          onClick={() => {
            signOut();
            requestLogin({ reason: `Entre com ${invite.maskedEmail} para aceitar o convite` });
          }}
        >
          Entrar com outro e-mail
        </Button>
      </Centered>
    );
  }

  return (
    <Centered>
      {accepted ? (
        <>
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-bold">Convite aceito</h1>
          <p className="mb-6 text-sm text-muted-foreground">Abrindo o admin…</p>
          <Button asChild className="rounded-full">
            <Link href={inviteDestination(accepted)}>Ir para o admin</Link>
          </Button>
        </>
      ) : (
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-label="Aceitando o convite" />
      )}
    </Centered>
  );
}

export default function ConvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteContent />
    </Suspense>
  );
}
