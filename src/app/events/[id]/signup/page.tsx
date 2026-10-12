'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Tag,
  Ticket,
  ExternalLink,
  ImagePlus,
  UserPlus,
  Video,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';

import { AddToCalendarButton } from '@/components/add-to-calendar-button';
import { SignupTicketQr } from '@/components/signup-ticket-qr';
import { SignupPixPayment } from '@/components/signup-pix-payment';
import { GuestPaymentResume } from '@/components/guest-payment-resume';
import { LoginRequired } from '@/components/login-required';
import { FadeIn } from '@/components/animations';
import { Button } from '@/components/ui/button';
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
import { useLoginPrompt } from '@/contexts/login-prompt-context';
import { useCouponLink } from '@/hooks/use-coupon-link';
import { useTracking } from '@/hooks/use-tracking';
import { usePaymentsV2 } from '@/hooks/use-payments-v2';
import { useGuestSignupSupport } from '@/hooks/use-guest-signup-support';
import { clearPendingCoupon } from '@/lib/coupon-link';
import {
  GET_EVENT_BY_SLUG_OR_ID,
  PREVIEW_COUPON,
  SIGNUP_TO_EVENT,
  SIGNUP_TO_EVENT_V2,
  SIGNUP_TO_EVENT_GUEST,
  VALIDATE_COUPON,
  IS_USER_SIGNED_UP,
} from '@/lib/queries';
import { cpfError, isCpfMessage, maskCpfInput } from '@/lib/cpf';
import { formatCents } from '@/lib/money';
import { HalfPriceChoice } from '@/components/half-price-choice';
import { discountLabel, halfPriceWinner, isPaymentLinkUnavailable, minChargeNotice } from '@/lib/payment-status';
import type { CouponPreview, PaymentKind } from '@/lib/types';
import { signupName } from '@/lib/signup-name';
import { acquireSignupLock, releaseSignupLock } from '@/lib/signup-lock';
import { signupErrorMessage } from '@/lib/signup-error';
import {
  cleanSignupPhone,
  guestSignupSuccessMessage,
  inlineSignupSchema,
  type InlineSignupValues,
} from '@/lib/inline-signup';
import {
  CERTIFICATE_NOTE,
  guestNextStep,
  guestNotice,
  paymentParam,
  type GuestNotice,
} from '@/lib/guest-signup';
import { adjustToBrazilTimezone } from '@/utils/event';

interface Batch {
  id: string;
  batch_number: number;
  value: number;
  max_quantity: number;
  enabled: boolean;
  half_price_eligible: boolean;
}

interface Product {
  id: string;
  enabled: boolean;
  name: string;
  batches: Batch[];
}

type SignupStep = 'select' | 'confirm' | 'processing' | 'success' | 'payment';

export default function EventSignupPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, updatePhone } = useAuth();
  const { requestLogin } = useLoginPrompt();
  const { track } = useTracking();
  const slugOrId = params.id as string;

  // State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [step, setStep] = useState<SignupStep>('select');
  const [signupResult, setSignupResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentPolling, setPaymentPolling] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isNewAccount, setIsNewAccount] = useState(false);
  // REA-22: signup without login (any batch, CPF and e-mail rules on the server).
  // false = older BFF: free batches only, paid ones through the login as before.
  const guestSupport = useGuestSignupSupport();
  const [guestResult, setGuestResult] = useState<GuestNotice | null>(null);
  // The way back to the Pix from the "Finalize sua inscrição" e-mail (?pagamento=<id>).
  const [resumePaymentId, setResumePaymentId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setResumePaymentId(paymentParam(new URLSearchParams(window.location.search).get('pagamento')));
  }, []);
  const [inlineBusy, setInlineBusy] = useState(false);
  // REA-6 (only with the new BFF): CPF on every signup, coupon priced by the server,
  // Pix or payment link.
  const paymentsV2 = usePaymentsV2();
  const [cpfInput, setCpfInput] = useState('');
  const [cpfFieldError, setCpfFieldError] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  // REA-16: half price on trust, declared with a checkbox. The coupon that last
  // validated travels with it, so the server can pick the larger discount.
  const [halfPrice, setHalfPrice] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [paymentAttempt, setPaymentAttempt] = useState(0);
  const [linkUnavailable, setLinkUnavailable] = useState(false);
  const lastSignupVars = useRef<Record<string, unknown> | null>(null);
  // REA-18: coupon of a ready-made link (#cupom=CODE). It only fills the field in;
  // the server still validates and prices it.
  const { code: linkCoupon, clear: clearLinkCoupon } = useCouponLink(slugOrId);
  const [couponFromLink, setCouponFromLink] = useState(false);

  // Inline signup form (for unauthenticated users)
  const inlineForm = useForm<InlineSignupValues>({
    resolver: zodResolver(inlineSignupSchema),
    defaultValues: { name: '', email: '', phone: '' },
  });

  // Queries & Mutations
  const { data, loading } = useQuery(GET_EVENT_BY_SLUG_OR_ID, {
    variables: { slugOrId },
  });

  const [validateCoupon, { loading: validatingLegacyCoupon }] = useLazyQuery(VALIDATE_COUPON);
  const [previewCoupon, { loading: previewingCoupon }] = useLazyQuery(PREVIEW_COUPON, {
    fetchPolicy: 'network-only',
  });
  const validatingCoupon = validatingLegacyCoupon || previewingCoupon;

  const { data: signupCheckData, loading: checkingSignup } = useQuery(IS_USER_SIGNED_UP, {
    variables: { eventId: slugOrId, email: user?.email || '' },
    skip: !isAuthenticated || !user?.email,
  });

  const [signupToEventLegacy, { loading: signingUpLegacy }] = useMutation(SIGNUP_TO_EVENT);
  const [signupToEventV2, { loading: signingUpV2 }] = useMutation(SIGNUP_TO_EVENT_V2);
  const [signupToEventGuest, { loading: signingUpGuest }] = useMutation(SIGNUP_TO_EVENT_GUEST);
  const signingUp = signingUpLegacy || signingUpV2 || signingUpGuest;

  const event = data?.eventBySlugOrId;
  const isAlreadySignedUp = signupCheckData?.isUserSignedUp?.is_signed_up;
  const callLink = signupCheckData?.isUserSignedUp?.call_link;
  const existingSignupId: string | null = signupCheckData?.isUserSignedUp?.signup_id ?? null;

  // Raw products with enabled batches (exclude hidden products like import-only batches)
  const allAvailableProducts: Product[] = useMemo(
    () =>
      (event?.products || []).filter(
        (p: Product) => p.enabled && (p as any).can_be_listed !== false && p.batches?.some((b: Batch) => b.enabled)
      ),
    [event?.products]
  );

  // REA-22: a guest sees every batch, paid ones included (the Pix comes right after
  // the signup). Only an older BFF, without the signup-without-login rules, keeps
  // guests on free batches, with paid ones going through the login.
  const availableProducts: Product[] = useMemo(() => {
    if (isAuthenticated || guestSupport !== false) return allAvailableProducts;
    return allAvailableProducts
      .map((p) => ({
        ...p,
        batches: p.batches.filter((b) => b.enabled && b.value === 0),
      }))
      .filter((p) => p.batches.length > 0);
  }, [allAvailableProducts, isAuthenticated, guestSupport]);

  // If the event has no free batches and the user is not authenticated, the
  // inline flow can't help them (older BFF) — ask for the login right here (REA-25).
  const onlyPaidForGuest =
    !loading &&
    !isAuthenticated &&
    guestSupport === false &&
    allAvailableProducts.length > 0 &&
    availableProducts.length === 0;

  // Auto-select when there's only one product with one batch
  useEffect(() => {
    if (availableProducts.length === 1) {
      const product = availableProducts[0];
      const enabledBatches = product.batches.filter((b) => b.enabled);
      if (enabledBatches.length === 1 && !selectedBatch) {
        setSelectedProduct(product);
        setSelectedBatch(enabledBatches[0]);
      }
    }
  }, [availableProducts, selectedBatch]);

  // A CPF already on the account fills the field (still editable).
  useEffect(() => {
    if (user?.cpf && !cpfInput) setCpfInput(maskCpfInput(user.cpf));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.cpf]);

  // The server prices a coupon per batch: another batch needs a new preview, and
  // the half-price choice starts over (the next batch may not offer it).
  useEffect(() => {
    setCouponPreview(null);
    setHalfPrice(false);
    setAppliedCoupon('');
    if (paymentsV2) setCouponMessage('');
  }, [selectedBatch?.id, paymentsV2]);

  const halfPriceOffered = !!paymentsV2 && !!selectedBatch?.half_price_eligible && (selectedBatch?.value || 0) > 0;

  // Calculate price. With the new BFF the coupon price is the server's (coupon or
  // half price, never both); the legacy path keeps today's percentage.
  const basePrice = selectedBatch?.value || 0;
  const previewApplies = !!couponPreview?.valid && typeof couponPreview.final_value === 'number';
  const discountedPrice = previewApplies
    ? Number(couponPreview!.final_value)
    : couponDiscount
      ? basePrice - (basePrice * couponDiscount) / 100
      : basePrice;
  const finalPrice = discountedPrice;
  const discountCents = basePrice - finalPrice;
  const discountText = previewApplies
    ? discountLabel(couponPreview!.discount_kind)
    : couponDiscount
      ? `Desconto (${couponDiscount}%)`
      : null;
  const couponApplied = paymentsV2 ? !!appliedCoupon : !!couponDiscount;
  // Coupon and half price together: the server keeps the larger discount (half price on a tie).
  const bestDiscountNote =
    halfPrice && appliedCoupon && previewApplies ? halfPriceWinner(couponPreview!.discount_kind) : null;

  // Asks the server for the price of the selected batch with this coupon and/or half price.
  const refreshPrice = async (code: string, isStudent: boolean): Promise<void> => {
    if (!selectedBatch) return;
    if (!code && !isStudent) {
      setCouponPreview(null);
      return;
    }
    try {
      const { data, error } = await previewCoupon({
        variables: { eventSlug: slugOrId, batchId: selectedBatch.id, code, isStudent },
      });
      if (error) throw error;
      const result: CouponPreview | null = data?.previewCoupon ?? null;
      if (result?.valid) {
        setCouponPreview(result);
        setAppliedCoupon(code);
        if (code) setCouponMessage(result.message || 'Cupom aplicado.');
        return;
      }
      setCouponPreview(null);
      setAppliedCoupon('');
      if (code) {
        setCouponMessage(result?.message || 'Cupom inválido.');
        // The coupon was refused: half price alone still has its price.
        if (isStudent) await refreshPrice('', true);
      } else {
        setCouponMessage(result?.message || 'Não foi possível calcular a meia-entrada.');
      }
    } catch {
      setCouponPreview(null);
      setCouponMessage(code ? 'Erro ao validar cupom.' : 'Erro ao calcular a meia-entrada.');
    }
  };

  const toggleHalfPrice = (checked: boolean) => {
    setHalfPrice(checked);
    void refreshPrice(appliedCoupon, checked);
  };

  // Handle coupon validation
  const applyCoupon = async (code: string) => {
    if (!code) return;
    if (paymentsV2) {
      await refreshPrice(code, halfPrice);
      return;
    }
    try {
      const { data } = await validateCoupon({
        variables: { eventSlug: slugOrId, code },
      });
      const result = data?.validateCoupon;
      if (result?.valid) {
        setCouponDiscount(result.discount_percentage);
        setCouponMessage(result.message);
      } else {
        setCouponDiscount(null);
        setCouponMessage(result?.message || 'Cupom inválido.');
      }
    } catch {
      setCouponMessage('Erro ao validar cupom.');
    }
  };

  const handleValidateCoupon = () => applyCoupon(couponCode.trim());

  // Ready-made link (REA-18): the code fills the field and goes to the server for
  // the chosen batch, again on every batch change. A refusal only shows the
  // server's message; the signup goes on without the discount.
  useEffect(() => {
    if (!linkCoupon || paymentsV2 === null || !selectedBatch || selectedBatch.value <= 0) return;
    setCouponCode(linkCoupon);
    setCouponFromLink(true);
    void applyCoupon(linkCoupon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCoupon, paymentsV2, selectedBatch?.id]);

  // Typing another code, or removing it, lets go of the coupon of the link.
  const forgetLinkCoupon = () => {
    if (!couponFromLink) return;
    setCouponFromLink(false);
    clearLinkCoupon();
  };

  const removeCoupon = () => {
    forgetLinkCoupon();
    setCouponCode('');
    setCouponDiscount(null);
    setCouponMessage('');
    if (appliedCoupon) {
      setAppliedCoupon('');
      void refreshPrice('', halfPrice);
    }
  };

  // CPF is required on every signup once the server stores it (REA-6).
  const checkCpf = (): boolean => {
    if (!paymentsV2) return true;
    const error = cpfError(cpfInput);
    setCpfFieldError(error || '');
    return !error;
  };

  // A refused signup: CPF messages go under the CPF field, the rest on top.
  const showSignupError = (message: string) => {
    if (paymentsV2 && isCpfMessage(message)) {
      setCpfFieldError(message);
      setErrorMessage('');
    } else {
      setErrorMessage(message);
    }
  };

  // signupToEvent with the arguments the connected BFF knows.
  const submitSignup = async (variables: Record<string, unknown>, kind: PaymentKind = 'PIX_QR') => {
    if (paymentsV2) {
      const v2 = { ...variables, cpf: cpfInput.replace(/\D/g, ''), kind };
      lastSignupVars.current = v2;
      const { data } = await signupToEventV2({ variables: v2 });
      return data?.signupToEvent;
    }
    const { data } = await signupToEventLegacy({ variables });
    return data?.signupToEvent;
  };

  // Handle signup (authenticated path)
  const handleSignup = async () => {
    if (!user || !selectedBatch) return;

    if (!checkCpf()) {
      setStep('confirm');
      return;
    }

    // If user has no phone and didn't provide one, show error
    if (!user.phone && !phoneInput.trim()) {
      setPhoneError('Informe seu WhatsApp para prosseguir com a inscrição.');
      setStep('confirm');
      return;
    }

    // Validate phone format if provided
    if (!user.phone && phoneInput.trim()) {
      const digitsOnly = phoneInput.replace(/\D/g, '');
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        setPhoneError('Informe um número válido com código do país (ex: +55 11 98765-4321).');
        setStep('confirm');
        return;
      }
    }

    setStep('processing');
    setErrorMessage('');
    setPhoneError('');

    try {
      // If user has no phone, update it first
      if (!user.phone && phoneInput.trim()) {
        const cleaned = phoneInput.replace(/[^\d+\s()-]/g, '');
        await updatePhone(cleaned);
      }

      const phoneToSend = user.phone || phoneInput.replace(/[^\d+\s()-]/g, '');

      const variables: any = {
        eventId: slugOrId,
        name: signupName(user),
        email: user.email,
        batch_id: selectedBatch.id,
        phone_number: phoneToSend || undefined,
      };

      if (couponCode && couponApplied) {
        variables.coupon_code = paymentsV2 ? appliedCoupon : couponCode;
      }
      if (halfPrice) variables.is_student = true;

      const result = await submitSignup(variables);

      if (result?.success) {
        setSignupResult(result);
        clearPendingCoupon(slugOrId);
        track({
          eventType: 'signup_complete',
          eventDocumentId: event?.documentId,
          metadata: { route: `/events/${slugOrId}/signup`, isNewAccount: false },
        });
        // The server's word wins: a coupon or half price may have made it free.
        const isFree = typeof result.is_free === 'boolean' ? result.is_free : finalPrice === 0;
        setStep(isFree ? 'success' : 'payment');
      } else {
        showSignupError(result?.message || 'Erro ao realizar inscrição.');
        setStep('confirm');
      }
    } catch (err: any) {
      showSignupError(err.message || 'Erro ao realizar inscrição.');
      setStep('confirm');
    }
  };

  // Pix ↔ payment link: a new attempt on the same signup (spec §0). Resolves to an
  // error message, or null once the step has the new charge.
  const handleChangeKind = useCallback(
    async (kind: PaymentKind): Promise<string | null> => {
      if (!lastSignupVars.current) return 'Não foi possível trocar a forma de pagamento.';
      try {
        const v2 = { ...lastSignupVars.current, kind };
        const { data } = await signupToEventV2({ variables: v2 });
        const result = data?.signupToEvent;
        if (result?.success && result.payment) {
          lastSignupVars.current = v2;
          setSignupResult(result);
          setPaymentAttempt((n) => n + 1);
          return null;
        }
        const message = result?.message || 'Não foi possível trocar a forma de pagamento.';
        if (kind === 'PAYMENT_LINK' && isPaymentLinkUnavailable(message)) setLinkUnavailable(true);
        return message;
      } catch (err: any) {
        return err?.message || 'Não foi possível trocar a forma de pagamento.';
      }
    },
    [signupToEventV2],
  );

  // Opa Pingou: the webhook confirmed the payment while the Pix step was polling.
  const handlePaid = useCallback(() => setStep('success'), []);

  // The charge expired or was canceled: the slot is free again, start over.
  const handleRetryPayment = useCallback(() => {
    setSignupResult(null);
    setPaymentAttempt((n) => n + 1);
    setStep('select');
  }, []);

  // Handle inline signup + event registration (guest path)
  const handleInlineSignup = async (values: InlineSignupValues) => {
    if (!selectedBatch || inlineBusy) return;
    if (!checkCpf()) return;

    // Held only by a successful signup: any failure below releases it, so a
    // corrected retry goes through instead of hitting "em andamento".
    if (!acquireSignupLock(slugOrId, values.email)) {
      setErrorMessage('Inscrição em andamento. Aguarde alguns segundos antes de tentar novamente.');
      setStep('confirm');
      return;
    }
    let succeeded = false;

    setInlineBusy(true);
    setStep('processing');
    setErrorMessage('');

    const cleanedPhone = cleanSignupPhone(values.phone);

    try {
      // No account step: the BFF creates it (password pending) and e-mails
      // the ticket with a "Crie sua senha" link.
      const variables: any = {
        eventId: slugOrId,
        name: values.name,
        email: values.email,
        batch_id: selectedBatch.id,
        phone_number: cleanedPhone || undefined,
      };
      if (couponCode && couponApplied) {
        variables.coupon_code = paymentsV2 ? appliedCoupon : couponCode;
      }
      if (halfPrice) variables.is_student = true;

      let result;
      if (guestSupport) {
        const { data } = await signupToEventGuest({
          variables: { ...variables, cpf: cpfInput.replace(/\D/g, ''), kind: 'PIX_QR' },
        });
        result = data?.signupToEvent;
      } else {
        result = await submitSignup(variables);
      }

      if (result?.success) {
        succeeded = true;
        setSignupResult(result);
        clearPendingCoupon(slugOrId);
        setIsNewAccount(true);
        if (guestSupport) setGuestResult(guestNotice(result, values.email));
        track({
          eventType: 'signup_complete',
          eventDocumentId: event?.documentId,
          metadata: { route: `/events/${slugOrId}/signup`, isNewAccount: true, outcome: result.outcome ?? null },
        });
        setStep(guestSupport ? guestNextStep(result) : 'success');
      } else {
        showSignupError(result?.message || 'Erro ao realizar inscrição.');
        setStep('confirm');
      }
    } catch (err: any) {
      showSignupError(signupErrorMessage(err));
      setStep('confirm');
    } finally {
      if (!succeeded) releaseSignupLock(slugOrId, values.email);
      setInlineBusy(false);
    }
  };

  if (loading || checkingSignup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Evento não encontrado</h2>
          <Link href="/events">
            <Button>Voltar para eventos</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Only paid batches and no session (older BFF): the login opens over this page, which
  // carries on after it with the coupon of the link still applied (REA-18, it stays mounted).
  if (onlyPaidForGuest) {
    return (
      <div className="min-h-screen bg-background">
        <LoginRequired
          title="Entre para se inscrever"
          description={
            <>
              A inscrição em <strong className="text-foreground">{event.title}</strong> precisa da
              sua conta. Entre ou cadastre-se e você continua aqui.
            </>
          }
        />
      </div>
    );
  }

  const startDate = adjustToBrazilTimezone(new Date(event.start_date));

  // Already signed up — show confirmation
  if (isAlreadySignedUp) {
    return (
      <FadeIn direction="up" duration={0.3}>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Link href={`/events/${event.slug || slugOrId}`}>
              <Button variant="ghost" size="sm" className="mb-6 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao evento
              </Button>
            </Link>

            <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Você já está inscrito!</h1>
                <p className="text-muted-foreground">
                  Sua inscrição no evento <strong>{event.title}</strong> já foi confirmada.
                </p>
              </div>

              {existingSignupId && <SignupTicketQr eventSlug={event.slug || slugOrId} signupId={existingSignupId} />}

              {event.is_online && callLink && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                  <div className="flex items-center gap-2 justify-center mb-3">
                    <Video className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Link da Chamada</h3>
                  </div>
                  <a
                    href={callLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  >
                    Acessar reunião
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}

              <AddToCalendarButton
                title={event.title}
                description={event.description}
                startDate={event.start_date}
                endDate={event.end_date}
                location={
                  event.location
                    ? event.location.full_address || event.location.title || event.location.city
                    : undefined
                }
                isOnline={event.is_online}
                callLink={callLink}
                variant="default"
                size="lg"
              />

              <div className="pt-4 flex flex-wrap gap-3 justify-center">
                <Link href={`/events/${event.slug || slugOrId}/arte`}>
                  <Button className="rounded-full">
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Gerar minha arte
                  </Button>
                </Link>
                <Link href={`/events/${event.slug || slugOrId}`}>
                  <Button variant="outline" className="rounded-full">
                    Ver detalhes do evento
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Back button */}
          <Link href={`/events/${event.slug || slugOrId}`}>
            <Button variant="ghost" size="sm" className="mb-6 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao evento
            </Button>
          </Link>

          {/* Event Header Card */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden mb-8">
            <div className="relative h-48 bg-black">
              {event.images?.[0] && (
                <Image
                  src={event.images[0]}
                  alt={event.title}
                  fill
                  className="object-cover opacity-60"
                  unoptimized
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h1 className="text-2xl font-bold text-white mb-2">{event.title}</h1>
                <div className="flex flex-wrap gap-4 text-white/80 text-sm">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {startDate.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {startDate.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {event.location.title || event.location.city}
                    </span>
                  )}
                  {event.is_online && (
                    <span className="flex items-center gap-1 text-green-400">
                      <Video className="h-4 w-4" />
                      Online
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* User info strip */}
            <div className="px-6 py-4 border-t border-border/50 bg-card/50 flex items-center justify-between">
              {isAuthenticated ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Inscrevendo como</p>
                    <p className="font-medium text-foreground">{user?.email}</p>
                  </div>
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">
                      {(user?.username || user?.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Novo por aqui?</p>
                    <p className="font-medium text-foreground">
                      Preencha seus dados abaixo para se inscrever.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestLogin({ reason: 'Entre para se inscrever com a sua conta' })}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Já tenho conta
                  </button>
                </>
              )}
            </div>
          </div>

          {/* REA-22: back to the Pix from the e-mail */}
          {resumePaymentId && step === 'select' && (
            <GuestPaymentResume
              signupId={resumePaymentId}
              onStartOver={() => {
                setResumePaymentId(null);
                router.replace(`/events/${slugOrId}/signup`);
              }}
            />
          )}

          {/* Step: Select Product/Batch */}
          {step === 'select' && !resumePaymentId && (
            <div className="space-y-6">
              {availableProducts.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Ticket className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground mb-2">Inscrições indisponíveis</h2>
                  <p className="text-sm text-muted-foreground">
                    Não há ingressos disponíveis para este evento no momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-primary" />
                    Selecione seu ingresso
                  </h2>

                  {availableProducts.map((product) => (
                    <div
                      key={product.id}
                      className="bg-card border border-border rounded-2xl overflow-hidden"
                    >
                      <div className="px-6 py-4 border-b border-border/50 bg-muted/30">
                        <h3 className="font-semibold text-foreground">{product.name}</h3>
                      </div>
                      <div className="p-4 space-y-3">
                        {product.batches
                          .filter((b) => b.enabled)
                          .sort((a, b) => a.batch_number - b.batch_number)
                          .map((batch) => {
                            const isSelected =
                              selectedProduct?.id === product.id &&
                              selectedBatch?.id === batch.id;

                            return (
                              <button
                                key={batch.id}
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setSelectedBatch(batch);
                                }}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                  isSelected
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                                }`}
                              >
                                <div className="text-left">
                                  <p className="font-medium text-foreground">
                                    {batch.batch_number}º Lote
                                  </p>
                                  {batch.half_price_eligible && (
                                    <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                      Meia-entrada disponível
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-foreground">
                                    {batch.value === 0
                                      ? 'Grátis'
                                      : formatCents(batch.value)}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}

                  {halfPriceOffered && (
                    <HalfPriceChoice
                      checked={halfPrice}
                      onCheckedChange={toggleHalfPrice}
                      disabled={previewingCoupon}
                    />
                  )}

                  {/* Coupon — only show for paid batches */}
                  {selectedBatch && selectedBatch.value > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-6">
                      <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        Cupom de desconto
                      </h3>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Digite seu cupom"
                          value={couponCode}
                          onChange={(e) => {
                            forgetLinkCoupon();
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponDiscount(null);
                            setCouponMessage('');
                            if (appliedCoupon) {
                              setAppliedCoupon('');
                              void refreshPrice('', halfPrice);
                            } else if (!halfPrice) {
                              setCouponPreview(null);
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={handleValidateCoupon}
                          disabled={validatingCoupon || !couponCode.trim()}
                        >
                          {validatingCoupon ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Aplicar'
                          )}
                        </Button>
                      </div>
                      {couponMessage && (
                        <p
                          className={`text-sm mt-2 ${
                            couponDiscount || appliedCoupon ? 'text-green-600' : 'text-red-500'
                          }`}
                        >
                          {couponMessage}
                        </p>
                      )}
                      {couponFromLink && !couponApplied && couponMessage && !validatingCoupon && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Você pode seguir com a inscrição sem o desconto.
                        </p>
                      )}
                      {couponApplied && (
                        <div
                          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-green-600/30 bg-green-500/10 px-3 py-2"
                          data-testid="applied-coupon"
                        >
                          <p className="text-sm text-foreground">
                            Cupom{' '}
                            <strong className="font-mono">{paymentsV2 ? appliedCoupon : couponCode}</strong>{' '}
                            {couponFromLink ? 'aplicado pelo link.' : 'aplicado.'}
                          </p>
                          <Button variant="ghost" size="sm" onClick={removeCoupon}>
                            Remover
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary & Continue */}
                  {selectedBatch && (
                    <div className="bg-card border border-primary/30 rounded-2xl p-6">
                      <h3 className="font-semibold text-foreground mb-4">Resumo</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {selectedProduct?.name} — {selectedBatch.batch_number}º Lote
                          </span>
                          <span className="text-foreground">
                            {basePrice === 0 ? 'Grátis' : formatCents(basePrice)}
                          </span>
                        </div>
                        {discountText && discountCents > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>{discountText}</span>
                            <span>-{formatCents(discountCents)}</span>
                          </div>
                        )}
                        {bestDiscountNote && (
                          <p className="text-xs text-muted-foreground" data-testid="best-discount">
                            {bestDiscountNote}
                          </p>
                        )}
                        {previewApplies && couponPreview?.min_charge_applied && (
                          <p className="text-xs text-amber-600">{minChargeNotice(finalPrice)}</p>
                        )}
                        <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                          <span>Total</span>
                          <span className="text-primary">
                            {finalPrice === 0
                              ? 'Grátis'
                              : formatCents(finalPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Phone input — only for authenticated users without a phone on file.
                          Guests collect their phone on the inline signup form in the confirm step. */}
                      {isAuthenticated && !user?.phone && (
                        <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/30 rounded-xl space-y-3">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-amber-600" />
                            <h4 className="font-medium text-foreground text-sm">WhatsApp</h4>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Informe seu WhatsApp para receber informações sobre o evento.
                            Aceita números internacionais.
                          </p>
                          <Input
                            type="tel"
                            placeholder="+55 11 98765-4321"
                            value={phoneInput}
                            onChange={(e) => {
                              setPhoneInput(e.target.value);
                              setPhoneError('');
                            }}
                          />
                          {phoneError && (
                            <p className="text-xs text-red-500">{phoneError}</p>
                          )}
                        </div>
                      )}

                      <Button
                        className="w-full mt-6 rounded-full"
                        size="lg"
                        onClick={() => setStep('confirm')}
                        disabled={(isAuthenticated && !user?.phone && !phoneInput.trim()) || previewingCoupon}
                      >
                        {finalPrice === 0 ? 'Confirmar Inscrição' : 'Continuar para pagamento'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step: Confirm (authenticated user) */}
          {step === 'confirm' && isAuthenticated && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Confirmar Inscrição</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-muted-foreground">Evento</span>
                  <span className="font-medium text-foreground">{event.title}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/30">
                  <span className="text-muted-foreground">Participante</span>
                  <span className="font-medium text-foreground">{user?.email}</span>
                </div>
                {selectedProduct && (
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">Produto</span>
                    <span className="font-medium text-foreground">
                      {selectedProduct.name} — {selectedBatch?.batch_number}º Lote
                    </span>
                  </div>
                )}
                {discountText && discountCents > 0 && (
                  <div className="flex justify-between py-2 border-b border-border/30 text-green-600">
                    <span>{discountText}</span>
                    <span>-{formatCents(discountCents)}</span>
                  </div>
                )}
                {(user?.phone || phoneInput) && (
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-muted-foreground">WhatsApp</span>
                    <span className="font-medium text-foreground">{user?.phone || phoneInput}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">
                    {finalPrice === 0
                      ? 'Grátis'
                      : formatCents(finalPrice)}
                  </span>
                </div>
              </div>

              {paymentsV2 && (
                <div className="space-y-2">
                  <label htmlFor="signup-cpf" className="text-sm font-medium text-foreground">
                    CPF
                  </label>
                  <Input
                    id="signup-cpf"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    value={cpfInput}
                    onChange={(e) => {
                      setCpfInput(maskCpfInput(e.target.value));
                      setCpfFieldError('');
                    }}
                    aria-invalid={!!cpfFieldError}
                    aria-describedby="signup-cpf-help"
                  />
                  <p id="signup-cpf-help" className={`text-xs ${cpfFieldError ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {cpfFieldError || 'Obrigatório para a inscrição.'}
                  </p>
                </div>
              )}

              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-600 text-sm">
                  {errorMessage}
                </div>
              )}
              {phoneError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-600 text-sm">
                  {phoneError}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => {
                    setStep('select');
                    setErrorMessage('');
                  }}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1 rounded-full"
                  size="lg"
                  onClick={handleSignup}
                  disabled={signingUp || paymentsV2 === null}
                >
                  {signingUp ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Confirmar Inscrição'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Confirm (guest — inline signup form) */}
          {step === 'confirm' && !isAuthenticated && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Seus dados</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Preencha abaixo para confirmar sua inscrição em{' '}
                <strong>{event.title}</strong>.
              </p>

              <Form {...inlineForm}>
                <form onSubmit={inlineForm.handleSubmit(handleInlineSignup)} className="space-y-4">
                  <FormField
                    control={inlineForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome completo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="João da Silva"
                            autoComplete="name"
                            disabled={inlineBusy}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={inlineForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="joao@exemplo.com"
                            autoComplete="email"
                            disabled={inlineBusy}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={inlineForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+55 11 98765-4321"
                            autoComplete="tel"
                            maxLength={20}
                            disabled={inlineBusy}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {paymentsV2 && (
                    <div className="space-y-2">
                      <label htmlFor="signup-cpf" className="text-sm font-medium text-foreground">
                        CPF
                      </label>
                      <Input
                        id="signup-cpf"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="000.000.000-00"
                        value={cpfInput}
                        onChange={(e) => {
                          setCpfInput(maskCpfInput(e.target.value));
                          setCpfFieldError('');
                        }}
                        aria-invalid={!!cpfFieldError}
                        aria-describedby="signup-cpf-help"
                        disabled={inlineBusy}
                      />
                      <p id="signup-cpf-help" className={`text-xs ${cpfFieldError ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {cpfFieldError || 'Obrigatório para a inscrição.'}
                      </p>
                    </div>
                  )}

                  <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {selectedProduct?.name} — {selectedBatch?.batch_number}º Lote
                      </span>
                      <span className="font-medium text-foreground">
                        {finalPrice === 0 ? 'Grátis' : formatCents(finalPrice)}
                      </span>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-600 text-sm">
                      {errorMessage}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-full"
                      onClick={() => {
                        setStep('select');
                        setErrorMessage('');
                      }}
                      disabled={inlineBusy}
                    >
                      Voltar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 rounded-full"
                      size="lg"
                      disabled={inlineBusy || signingUp || paymentsV2 === null}
                    >
                      {inlineBusy || signingUp ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        'Inscrever-se'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground">Processando inscrição...</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Aguarde enquanto confirmamos sua inscrição.
              </p>
            </div>
          )}

          {/* Step: Success (Free Event) */}
          {step === 'success' && (
            <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {guestResult?.title ?? 'Inscrição Confirmada! 🎉'}
                </h2>
                {guestResult && !guestResult.ownSignup ? (
                  <p className="text-muted-foreground" data-testid="guest-notice">
                    {guestResult.body}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Sua inscrição no evento <strong>{event.title}</strong> foi realizada com sucesso.
                  </p>
                )}
              </div>

              {signupResult?.signup_id && (
                <SignupTicketQr eventSlug={event.slug || slugOrId} signupId={signupResult.signup_id} />
              )}

              {guestResult?.ownSignup && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-left space-y-2" data-testid="guest-notice">
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Confira seu email</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{guestResult.body}</p>
                  <p className="text-sm text-muted-foreground">{CERTIFICATE_NOTE}</p>
                </div>
              )}

              {isNewAccount && !guestResult && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Confira seu email</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {guestSignupSuccessMessage(inlineForm.getValues('email'))}. Verifique também
                    sua caixa de spam.
                  </p>
                </div>
              )}

              {event.is_online && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                  <div className="flex items-center gap-2 justify-center mb-3">
                    <Video className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Evento Online</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    O link da chamada estará disponível na página do evento.
                  </p>
                </div>
              )}

              <AddToCalendarButton
                title={event.title}
                description={event.description}
                startDate={event.start_date}
                endDate={event.end_date}
                location={
                  event.location
                    ? event.location.full_address || event.location.title || event.location.city
                    : undefined
                }
                isOnline={event.is_online}
                callLink={callLink || event.call_link}
                variant="default"
                size="lg"
              />

              <div className="flex flex-wrap gap-3 justify-center">
                {/* The generator checks the signup by the logged-in e-mail, so guests go via login. */}
                {isAuthenticated && (
                  <Link href={`/events/${event.slug || slugOrId}/arte`}>
                    <Button className="rounded-full" size="lg">
                      <ImagePlus className="h-4 w-4 mr-2" />
                      Gerar minha arte &quot;me inscrevi&quot;
                    </Button>
                  </Link>
                )}
                <Link href={`/events/${event.slug || slugOrId}`}>
                  <Button className="rounded-full" size="lg" variant={isAuthenticated ? 'outline' : 'default'}>
                    Ver página do evento
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Step: Payment (Paid Event) */}
          {step === 'payment' && signupResult?.payment && (
            <div className="space-y-6">
              {guestResult && (
                <p className="text-sm text-muted-foreground text-center" data-testid="guest-payment-note">
                  Enviamos também para {signupResult.confirmation_sent_to || inlineForm.getValues('email')} um
                  e-mail com o link para voltar a este Pix. {CERTIFICATE_NOTE}
                </p>
              )}
              <SignupPixPayment
                key={`${signupResult.signup_id}-${paymentAttempt}`}
                signupId={String(signupResult.signup_id)}
                initial={signupResult.payment}
                onPaid={handlePaid}
                onRetry={handleRetryPayment}
                // A guest has no session to ask for another kind with: the e-mail brings the Pix back.
                onChangeKind={paymentsV2 && isAuthenticated ? handleChangeKind : undefined}
                linkUnavailable={linkUnavailable}
              />
              <div className="text-center">
                <Link href={`/events/${event.slug || slugOrId}`}>
                  <Button variant="ghost" className="rounded-full">
                    Voltar para o evento
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </FadeIn>
  );
}
