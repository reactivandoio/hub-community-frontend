'use client';

import { useQuery } from '@apollo/client';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { SignupPixPayment } from '@/components/signup-pix-payment';
import { Button } from '@/components/ui/button';
import { SIGNUP_PAYMENT_STATUS } from '@/lib/queries';
import type { SignupPaymentStatus } from '@/lib/types';

interface GuestPaymentResumeProps {
  signupId: string;
  /** Leaves the payment link and shows the signup form again. */
  onStartOver: () => void;
}

/**
 * REA-22: the way back to the Pix from the "Finalize sua inscrição" e-mail
 * (`/events/<slug>/signup?pagamento=<id>`), for someone who signed up without login
 * and closed the page. signupPaymentStatus is public and carries no personal data.
 */
export function GuestPaymentResume({ signupId, onStartOver }: GuestPaymentResumeProps) {
  const [paid, setPaid] = useState(false);
  const { data, loading } = useQuery<{ signupPaymentStatus: SignupPaymentStatus | null }>(SIGNUP_PAYMENT_STATUS, {
    variables: { signupId },
    fetchPolicy: 'network-only',
  });
  const status = data?.signupPaymentStatus;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 flex justify-center" data-testid="payment-resume-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (paid || status?.status === 'CONFIRMED') {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Pagamento confirmado</h2>
        <p className="text-sm text-muted-foreground">
          Sua inscrição está confirmada. O ingresso foi enviado para o seu e-mail.
        </p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Pagamento não encontrado</h2>
        <p className="text-sm text-muted-foreground">
          Este link de pagamento não vale mais. Faça a inscrição de novo para gerar um novo Pix.
        </p>
        <Button className="rounded-full" onClick={onStartOver}>
          Fazer inscrição
        </Button>
      </div>
    );
  }

  return (
    <SignupPixPayment
      signupId={signupId}
      initial={status}
      onPaid={() => setPaid(true)}
      onRetry={onStartOver}
    />
  );
}
