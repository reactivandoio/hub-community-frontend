'use client';

import { useQuery } from '@apollo/client';
import {
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageCircle,
  QrCode,
  XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/money';
import {
  discountLabel,
  formatCountdown,
  isPaymentLinkUnavailable,
  isTerminalPhase,
  minChargeNotice,
  paymentPhase,
  refundContact,
} from '@/lib/payment-status';
import { SIGNUP_PAYMENT_STATUS } from '@/lib/queries';
import type { PaymentKind, SignupPayment, SignupPaymentStatus } from '@/lib/types';

const POLL_MS = 4000;

interface SignupPixPaymentProps {
  signupId: string;
  /** What signupToEvent returned: the first render needs no round trip. */
  initial: SignupPayment;
  onPaid: () => void;
  onRetry: () => void;
  /**
   * Asks the server for a charge of the other kind (a new attempt on the same
   * signup). Resolves to an error message, or null when the parent got a new
   * payment and remounts this step with it.
   */
  onChangeKind?: (kind: PaymentKind) => Promise<string | null>;
  /** The server already said the payment link is unavailable for this event. */
  linkUnavailable?: boolean;
}

/**
 * Opa Pingou payment step: Pix (QR + copia-e-cola) or payment link, chosen by the
 * participant, polling the payment until the webhook confirms it (→ onPaid) or the
 * 15-minute charge expires.
 */
export function SignupPixPayment({
  signupId,
  initial,
  onPaid,
  onRetry,
  onChangeKind,
  linkUnavailable = false,
}: SignupPixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [switching, setSwitching] = useState<PaymentKind | null>(null);
  const [switchError, setSwitchError] = useState('');
  const [linkGone, setLinkGone] = useState(linkUnavailable);

  const { data, stopPolling } = useQuery<{ signupPaymentStatus: SignupPaymentStatus | null }>(
    SIGNUP_PAYMENT_STATUS,
    { variables: { signupId }, pollInterval: POLL_MS, fetchPolicy: 'network-only' },
  );

  const payment = data?.signupPaymentStatus;
  const brCode = payment?.pix_br_code ?? initial.pix_br_code ?? null;
  const paymentLink = payment?.payment_link ?? initial.payment_link ?? null;
  const expiresAt = payment?.expires_at ?? initial.expires_at ?? null;
  const value = payment?.value ?? initial.value ?? null;
  const kind: PaymentKind =
    payment?.kind ?? initial.kind ?? (brCode || !paymentLink ? 'PIX_QR' : 'PAYMENT_LINK');
  const phase = paymentPhase(payment ?? { status: 'PEDING_PAYMENT', expires_at: expiresAt }, now);
  const refund = refundContact(payment?.refund_support);
  const discount = discountLabel(initial.discount_kind);
  const originalValue = Number(initial.original_value) || 0;
  const isLink = kind === 'PAYMENT_LINK';
  // A link charge without a link: the option goes away and Pix is offered.
  const linkMissing = isLink && !paymentLink;

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

  useEffect(() => {
    if (linkMissing) setLinkGone(true);
  }, [linkMissing]);

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

  const changeKind = async (next: PaymentKind) => {
    if (!onChangeKind || next === kind || switching) return;
    setSwitching(next);
    setSwitchError('');
    const error = await onChangeKind(next);
    setSwitching(null);
    if (!error) return;
    if (next === 'PAYMENT_LINK' && isPaymentLinkUnavailable(error)) {
      setLinkGone(true);
    } else {
      setSwitchError(error);
    }
  };

  const refundNote = refund && (
    <p className="text-xs text-muted-foreground">
      {refund.text}{' '}
      <a
        href={refund.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
      >
        <MessageCircle className="h-3 w-3" />
        WhatsApp do suporte
      </a>
    </p>
  );

  if (phase === 'expired' || phase === 'canceled' || phase === 'refunded') {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {phase === 'expired'
            ? isLink
              ? 'O prazo do pagamento acabou'
              : 'O prazo do Pix acabou'
            : 'Pagamento cancelado'}
        </h2>
        <p className="text-muted-foreground text-sm">
          Sua inscrição não foi confirmada e a vaga foi liberada. Se ainda houver vagas, você pode
          gerar um novo pagamento.
        </p>
        <Button className="rounded-full" onClick={onRetry}>
          Tentar novamente
        </Button>
        {refundNote}
      </div>
    );
  }

  const msLeft = expiresAt ? new Date(expiresAt).getTime() - now.getTime() : null;
  const showChoice = !!onChangeKind && !linkGone;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-6">
      <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
        {isLink ? (
          <CreditCard className="h-8 w-8 text-amber-500" />
        ) : (
          <QrCode className="h-8 w-8 text-amber-500" />
        )}
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">Pagamento pendente</h2>
        {value ? (
          <p className="text-2xl font-bold text-primary" data-testid="payment-value">
            {formatCents(value)}
          </p>
        ) : null}
        {discount && originalValue > Number(value) && (
          <p className="text-sm text-green-600">
            {discount}: de {formatCents(originalValue)} por {formatCents(value)}
          </p>
        )}
        {initial.min_charge_applied && (
          <p className="text-sm text-amber-600">{minChargeNotice(value)}</p>
        )}
        <p className="text-muted-foreground text-sm">
          Sua vaga fica reservada até o pagamento ou o fim do prazo.
        </p>
      </div>

      {showChoice && (
        <div
          role="radiogroup"
          aria-label="Forma de pagamento"
          className="grid grid-cols-2 gap-2 max-w-md mx-auto"
        >
          {(
            [
              { kind: 'PIX_QR', label: 'Pix', Icon: QrCode },
              { kind: 'PAYMENT_LINK', label: 'Link de pagamento (cartão)', Icon: CreditCard },
            ] as const
          ).map((option) => (
            <button
              key={option.kind}
              type="button"
              role="radio"
              aria-checked={kind === option.kind}
              disabled={!!switching}
              onClick={() => changeKind(option.kind)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-colors',
                kind === option.kind
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border/50 text-muted-foreground hover:border-primary/30',
              )}
            >
              {switching === option.kind ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <option.Icon className="h-4 w-4" />
              )}
              {option.label}
            </button>
          ))}
        </div>
      )}

      {linkGone && onChangeKind && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O link de pagamento não está disponível para este evento. Pague pelo Pix.
          </p>
          {isLink && (
            <Button
              variant="outline"
              className="rounded-full gap-2"
              disabled={!!switching}
              onClick={() => changeKind('PIX_QR')}
            >
              {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Pagar com Pix
            </Button>
          )}
        </div>
      )}
      {switchError && <p className="text-sm text-red-500">{switchError}</p>}

      {!isLink && brCode && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">Escaneie o QR Code ou copie o código Pix.</p>
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

      {isLink && paymentLink && (
        <div className="space-y-3">
          <a href={paymentLink} target="_blank" rel="noopener noreferrer">
            <Button className="rounded-full gap-2" size="lg">
              <CreditCard className="h-4 w-4" />
              Abrir link de pagamento
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
          <p className="text-muted-foreground text-xs">
            O pagamento abre em outra aba. Depois de pagar, volte aqui: esta página confirma sozinha.
          </p>
        </div>
      )}

      <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 flex items-center justify-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          Aguardando a confirmação do pagamento
          {msLeft !== null ? (
            <>
              {' '}
              · expira em <strong data-testid="payment-countdown">{formatCountdown(msLeft)}</strong>
            </>
          ) : null}
          . Esta página atualiza sozinha.
        </span>
      </div>

      {refundNote}
    </div>
  );
}
