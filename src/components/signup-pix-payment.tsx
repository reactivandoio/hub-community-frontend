'use client';

import { useQuery } from '@apollo/client';
import { CheckCircle2, Clock, Copy, CreditCard, ExternalLink, QrCode, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCents } from '@/lib/money';
import { isTerminalPhase, paymentPhase } from '@/lib/payment-status';
import { SIGNUP_PAYMENT_STATUS } from '@/lib/queries';
import type { SignupPaymentStatus } from '@/lib/types';

const POLL_MS = 4000;

interface SignupPixPaymentProps {
  signupId: string;
  /** What signupToEvent returned: the first render needs no round trip. */
  initial: {
    pix_br_code?: string | null;
    payment_link?: string | null;
    expires_at?: string | null;
    value?: number | null;
  };
  onPaid: () => void;
  onRetry: () => void;
}

/**
 * Opa Pingou Pix step: shows the copia-e-cola as a QR code and polls the payment
 * until the webhook confirms it (→ onPaid) or the charge expires.
 */
export function SignupPixPayment({ signupId, initial, onPaid, onRetry }: SignupPixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const { data, stopPolling } = useQuery<{ signupPaymentStatus: SignupPaymentStatus | null }>(
    SIGNUP_PAYMENT_STATUS,
    { variables: { signupId }, pollInterval: POLL_MS, fetchPolicy: 'network-only' },
  );

  const payment = data?.signupPaymentStatus;
  const brCode = payment?.pix_br_code ?? initial.pix_br_code ?? null;
  const paymentLink = payment?.payment_link ?? initial.payment_link ?? null;
  const expiresAt = payment?.expires_at ?? initial.expires_at ?? null;
  const value = payment?.value ?? initial.value ?? null;
  const phase = paymentPhase(payment ?? { status: 'PEDING_PAYMENT', expires_at: expiresAt }, now);

  // Re-evaluates the expiry once a second without hitting the server.
  useEffect(() => {
    if (isTerminalPhase(phase)) return undefined;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!isTerminalPhase(phase)) return;
    stopPolling();
    if (phase === 'paid') onPaid();
  }, [phase, stopPolling, onPaid]);

  const copy = async () => {
    if (!brCode) return;
    try {
      await navigator.clipboard.writeText(brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code stays selectable in the input.
    }
  };

  if (phase === 'expired' || phase === 'canceled' || phase === 'refunded') {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {phase === 'expired' ? 'O prazo do Pix acabou' : 'Pagamento cancelado'}
        </h2>
        <p className="text-muted-foreground text-sm">
          Sua inscrição não foi confirmada e a vaga foi liberada. Se ainda houver vagas, você pode
          gerar um novo Pix.
        </p>
        <Button className="rounded-full" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const minutesLeft = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 60000))
    : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-6">
      <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
        <QrCode className="h-8 w-8 text-amber-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">Pagamento pendente</h2>
        <p className="text-muted-foreground text-sm">
          {value ? <>Pague <strong>{formatCents(value)}</strong> pelo Pix. </> : null}
          Escaneie o QR Code ou copie o código. Sua vaga fica reservada até o pagamento ou o fim
          do prazo.
        </p>
      </div>

      {brCode && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl inline-block mx-auto">
            <QRCodeSVG value={brCode} size={192} aria-label="QR Code Pix" />
          </div>
          <div className="flex items-center gap-2 max-w-md mx-auto">
            <Input value={brCode} readOnly className="text-xs font-mono" aria-label="Pix copia e cola" />
            <Button variant="outline" size="sm" onClick={copy} aria-label="Copiar código Pix">
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {paymentLink && (
        <div className="border-t border-border pt-6">
          <a href={paymentLink} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="rounded-full gap-2" size="lg">
              <CreditCard className="h-4 w-4" />
              Pagar pelo link
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </div>
      )}

      <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 flex items-center justify-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          Aguardando a confirmação do pagamento
          {minutesLeft !== null ? ` · expira em ${minutesLeft} min` : ''}. Esta página atualiza
          sozinha.
        </span>
      </div>
    </div>
  );
}
