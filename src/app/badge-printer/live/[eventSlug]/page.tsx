'use client';

import { useQuery, useSubscription, useMutation } from '@apollo/client';
import {
  Check,
  Loader2,
  Monitor,
  Printer,
  QrCode,
  Search,
  Wifi,
  WifiOff,
  Users,
  Settings,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { FadeIn } from '@/components/animations';
import { ManualSignupDialog, type ManualSignupResult } from '@/components/badge-printer/manual-signup-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DEFAULT_BADGE_NAME, defaultBadgeLink, printBadge } from '@/lib/badge-print';
import {
  CREDENTIAL_CHECKED_IN,
  EVENT_SIGNUPS,
  CHECKIN_SIGNUP,
} from '@/lib/queries';
import {
  CheckinSignupResponse,
  CredentialCheckedInData,
  EventSignup,
  EventSignupsResponse,
} from '@/lib/types';

// Station settings survive reloads and are per event.
const settingsKey = (slug: string) => `badge-printer-live-v1:${slug}`;

// Radix dialog exit animation (200ms) plus a margin.
const DIALOG_CLOSE_MS = 300;

interface PrintedBadge {
  signup: EventSignup;
  printedAt: Date;
}

export default function LiveBadgePrinterPage() {
  const params = useParams();
  const eventSlug = params?.eventSlug as string;

  // Settings
  const [eventName, setEventName] = useState(DEFAULT_BADGE_NAME);
  const [badgeLink, setBadgeLink] = useState(() => defaultBadgeLink(eventSlug));
  const [isAutoprint, setIsAutoprint] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (!eventSlug) return;
    try {
      const saved = JSON.parse(localStorage.getItem(settingsKey(eventSlug)) || '{}');
      if (typeof saved.eventName === 'string') setEventName(saved.eventName);
      if (typeof saved.link === 'string') setBadgeLink(saved.link);
      if (typeof saved.autoprint === 'boolean') setIsAutoprint(saved.autoprint);
    } catch {
      // storage unavailable or corrupt: keep the defaults
    }
    setSettingsLoaded(true);
  }, [eventSlug]);

  useEffect(() => {
    if (!eventSlug || !settingsLoaded) return;
    try {
      localStorage.setItem(
        settingsKey(eventSlug),
        JSON.stringify({ eventName, link: badgeLink, autoprint: isAutoprint }),
      );
    } catch {
      // storage unavailable: settings just won't persist
    }
  }, [eventSlug, settingsLoaded, eventName, badgeLink, isAutoprint]);
  const [showSettings, setShowSettings] = useState(false);

  // State
  const [printedBadges, setPrintedBadges] = useState<PrintedBadge[]>([]);
  const [printQueue, setPrintQueue] = useState<EventSignup[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const printQueueRef = useRef<EventSignup[]>([]);
  const isPrintingRef = useRef(false);

  // Manual Checkin State
  const [showManualCheckin, setShowManualCheckin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [showManualSignup, setShowManualSignup] = useState(false);
  // Signups credentialed from the manual dialog print right there, so the
  // subscription echo of that same check-in must not print them again.
  const manualIdsRef = useRef<Set<string>>(new Set());

  // Hidden QR code canvas for badge printing
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  // The public check-in URL for the QR code
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const checkinUrl = `${baseUrl}/checkin/${eventSlug}`;

  // Fetch all signups to show stats
  const { data: signupsData, refetch: refetchSignups } = useQuery<EventSignupsResponse>(
    EVENT_SIGNUPS,
    {
      variables: { eventSlug },
      skip: !eventSlug,
      fetchPolicy: 'network-only',
    }
  );

  const [checkinSignup] = useMutation<CheckinSignupResponse>(CHECKIN_SIGNUP);

  const filteredSignups = searchTerm
    ? (signupsData?.eventSignups || []).filter((s) => {
        const term = searchTerm.toLowerCase();
        return (
          s.name.toLowerCase().includes(term) ||
          (s.email && s.email.toLowerCase().includes(term)) ||
          (s.phone_number && s.phone_number.includes(term))
        );
      }).slice(0, 10)
    : [];

  // Subscribe to real-time check-ins
  const { data: subscriptionData, error: subscriptionError } =
    useSubscription<CredentialCheckedInData>(CREDENTIAL_CHECKED_IN, {
      variables: { eventSlug },
      skip: !eventSlug,
    });

  // Process new check-in from subscription
  useEffect(() => {
    if (!subscriptionData?.credentialCheckedIn) return;

    const signup = subscriptionData.credentialCheckedIn;

    // Avoid duplicates
    if (printedBadges.some((pb) => pb.signup.id === signup.id)) return;
    if (manualIdsRef.current.has(signup.id)) return;

    if (isAutoprint) {
      // Add to print queue
      setPrintQueue((prev) => [...prev, signup]);
      printQueueRef.current = [...printQueueRef.current, signup];
    }

    // Refetch stats
    refetchSignups();
  }, [subscriptionData, isAutoprint, printedBadges, refetchSignups]);

  // Process print queue
  const processQueue = useCallback(async () => {
    if (isPrintingRef.current) return;
    if (printQueueRef.current.length === 0) return;

    isPrintingRef.current = true;
    setIsPrinting(true);

    const signup = printQueueRef.current[0];
    printQueueRef.current = printQueueRef.current.slice(1);
    setPrintQueue(printQueueRef.current);

    try {
      // Get QR code data URL from hidden canvas
      const canvas = qrCanvasRef.current?.querySelector('canvas');
      const qrDataUrl = canvas ? canvas.toDataURL() : '';

      await printBadge({
        fullName: signup.name,
        qrDataUrl,
        logoText: eventName,
        link: badgeLink,
      });

      setPrintedBadges((prev) => [
        { signup, printedAt: new Date() },
        ...prev,
      ]);
    } catch (err) {
      console.error('Print error:', err);
    } finally {
      isPrintingRef.current = false;
      setIsPrinting(false);

      // Process next in queue
      if (printQueueRef.current.length > 0) {
        setTimeout(processQueue, 500);
      }
    }
  }, [eventName, badgeLink]);

  // Trigger queue processing when items are added
  useEffect(() => {
    if (printQueue.length > 0 && !isPrintingRef.current) {
      processQueue();
    }
  }, [printQueue, processQueue]);

  // Manual print
  const handleManualPrint = useCallback(
    async (signup: EventSignup) => {
      const canvas = qrCanvasRef.current?.querySelector('canvas');
      const qrDataUrl = canvas ? canvas.toDataURL() : '';

      // Counted as soon as the print is fired: in kiosk mode the page may not get
      // control back until the print iframe is gone, so nothing waits on it.
      setPrintedBadges((prev) => {
        if (prev.some((pb) => pb.signup.id === signup.id)) return prev;
        return [{ signup, printedAt: new Date() }, ...prev];
      });

      void printBadge({
        fullName: signup.name,
        qrDataUrl,
        logoText: eventName,
        link: badgeLink,
      });
    },
    [eventName, badgeLink]
  );

  // Printing while the Radix dialog is open leaves it stuck (X does nothing, then the
  // body keeps pointer-events: none and the dialog never reopens). Close it first and
  // let its exit animation finish before printing.
  const closeDialogThenPrint = async (
    signup: EventSignup,
    closeDialog: () => void = () => setShowManualCheckin(false),
  ) => {
    closeDialog();
    await new Promise((resolve) => setTimeout(resolve, DIALOG_CLOSE_MS));
    document.body.style.pointerEvents = '';
    await handleManualPrint(signup);
  };

  // Check in, then open the print dialog for that badge. The BFF answers failures
  // with success: false, so they are shown instead of printing.
  const handleManualCheckin = async (
    signup: EventSignup,
    closeDialog?: () => void,
  ): Promise<boolean> => {
    setCheckingInId(signup.id);
    manualIdsRef.current.add(signup.id);
    try {
      const { data } = await checkinSignup({
        variables: { eventSlug, signupId: signup.id },
      });
      const result = data?.checkinSignup;
      if (!result?.success) {
        manualIdsRef.current.delete(signup.id);
        toast.error(`Check-in de ${signup.name} falhou: ${result?.message || 'erro desconhecido'}`);
        return false;
      }
      refetchSignups();
      await closeDialogThenPrint(result.signup || signup, closeDialog);
      return true;
    } catch (err) {
      manualIdsRef.current.delete(signup.id);
      toast.error(`Check-in de ${signup.name} falhou: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      setCheckingInId(null);
    }
  };

  // A walk-in signed up from the "Inscrição Manual" dialog: same check-in and print
  // as "Credenciar". Someone already checked in (signed up before) just gets the badge.
  const handleManualSignup = async ({ signup, matched_by, account_created }: ManualSignupResult & { signup: EventSignup }) => {
    const closeSignup = () => setShowManualSignup(false);
    const how = account_created
      ? 'conta criada; e-mails de confirmação e de cadastro enviados'
      : matched_by === 'cpf'
        ? 'conta encontrada pelo CPF; e-mail de confirmação enviado'
        : matched_by === 'email'
          ? 'conta encontrada pelo e-mail; e-mail de confirmação enviado'
          : 'inscrição confirmada';
    if (signup.checked_in) {
      manualIdsRef.current.add(signup.id);
      refetchSignups();
      toast.info(`${signup.name} já estava inscrito(a) e credenciado(a). Imprimindo o crachá.`);
      await closeDialogThenPrint(signup, closeSignup);
      return;
    }
    if (await handleManualCheckin(signup, closeSignup)) {
      toast.success(`${signup.name} inscrito(a) e credenciado(a) — ${how}.`);
    }
  };

  // Stats
  const totalSignups = signupsData?.eventSignups?.length || 0;
  const checkedInCount =
    signupsData?.eventSignups?.filter((s) => s.checked_in).length || 0;
  const printedCount = printedBadges.length;
  const isConnected = !subscriptionError;

  return (
    <main className="min-h-screen bg-background">
      {/* Hidden QR for badge printing */}
      <div ref={qrCanvasRef} className="hidden">
        <QRCodeCanvas value={badgeLink} size={256} level="H" />
      </div>

      <FadeIn direction="up" duration={0.3}>
        <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Estação de Credenciamento
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <Badge
                    variant={isConnected ? 'default' : 'destructive'}
                    className={`gap-1.5 text-xs ${
                      isConnected
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50 dark:text-emerald-400 dark:border-emerald-800/50'
                        : ''
                    }`}
                  >
                    {isConnected ? (
                      <Wifi className="w-3 h-3" />
                    ) : (
                      <WifiOff className="w-3 h-3" />
                    )}
                    {isConnected ? 'Conectado — Escutando check-ins' : 'Desconectado'}
                  </Badge>
                  {isPrinting && (
                    <Badge className="gap-1.5 text-xs bg-blue-500/10 text-blue-600 border-blue-200/50 dark:text-blue-400 dark:border-blue-800/50">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Imprimindo...
                    </Badge>
                  )}
                  {printQueue.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {printQueue.length} na fila
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog
                open={showManualCheckin}
                onOpenChange={(open) => {
                  setShowManualCheckin(open);
                  // Safety net for a body left locked by an interrupted close.
                  if (!open) setTimeout(() => { document.body.style.pointerEvents = ''; }, DIALOG_CLOSE_MS);
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" className="gap-2">
                    <Search className="w-4 h-4" />
                    Credenciamento Manual
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Credenciamento Manual</DialogTitle>
                    <DialogDescription>
                      Busque pelo nome, e-mail ou telefone do participante.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center relative">
                      <Search className="w-4 h-4 text-muted-foreground absolute left-3" />
                      <Input
                        placeholder="Buscar participante..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar pr-2">
                      {searchTerm.length > 0 && filteredSignups.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-4">
                          Nenhum participante encontrado.
                        </p>
                      ) : (
                        filteredSignups.map((signup) => (
                          <div
                            key={signup.id}
                            className="flex items-center justify-between p-3 rounded-xl border bg-card"
                          >
                            <div className="min-w-0 pr-4">
                              <p className="text-sm font-semibold truncate">{signup.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {signup.email || signup.phone_number || 'Sem contato'}
                              </p>
                              {signup.checked_in && (
                                <p className="text-[10px] uppercase font-bold text-emerald-600 mt-1 inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Credenciado
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => closeDialogThenPrint(signup)}
                                title="Imprimir Crachá"
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={signup.checked_in ? "outline" : "default"}
                                disabled={checkingInId === signup.id || signup.checked_in}
                                onClick={() => handleManualCheckin(signup)}
                              >
                                {checkingInId === signup.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : signup.checked_in ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  "Credenciar"
                                )}
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <ManualSignupDialog
                eventSlug={eventSlug}
                open={showManualSignup}
                onOpenChange={(open) => {
                  setShowManualSignup(open);
                  // Safety net for a body left locked by an interrupted close.
                  if (!open) setTimeout(() => { document.body.style.pointerEvents = ''; }, DIALOG_CLOSE_MS);
                }}
                onRegistered={handleManualSignup}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Configurações
              </Button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Configurações da Estação</CardTitle>
                <CardDescription>
                  Configure o texto do crachá e link do QR Code
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Evento/Comunidade</Label>
                    <Input
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="Ex: PARTICIPANTE"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Link do QR Code (Crachá)</Label>
                    <Input
                      value={badgeLink}
                      onChange={(e) => setBadgeLink(e.target.value)}
                      placeholder={defaultBadgeLink(eventSlug)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Impressão Automática</Label>
                    <div className="flex items-center gap-3 h-10">
                      <button
                        onClick={() => setIsAutoprint(!isAutoprint)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full 
                                    border-2 border-transparent transition-colors duration-200 ease-in-out
                                    focus:outline-none ${
                                      isAutoprint ? 'bg-primary' : 'bg-muted'
                                    }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 
                                      ease-in-out ${
                                        isAutoprint ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                        />
                      </button>
                      <span className="text-sm text-muted-foreground">
                        {isAutoprint ? 'Ativada' : 'Desativada'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* QR Code Display */}
            <Card className="lg:col-span-1">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-base flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4 text-primary" />
                  QR Code — Check-in
                </CardTitle>
                <CardDescription className="text-xs">
                  Participantes escaneiam para fazer check-in
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 py-6">
                <div className="bg-white p-6 rounded-2xl shadow-lg shadow-primary/5 border border-border/30">
                  <QRCodeCanvas
                    value={checkinUrl}
                    size={220}
                    level="H"
                    marginSize={2}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center break-all max-w-[280px]">
                  {checkinUrl}
                </p>
              </CardContent>
            </Card>

            {/* Stats + Printed Badges */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Credenciamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-muted/50 p-4 rounded-xl border border-border/50 text-center">
                    <div className="text-3xl font-bold">{totalSignups}</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-1">
                      Inscritos
                    </div>
                  </div>
                  <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-center">
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                      {checkedInCount}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider mt-1">
                      Check-ins
                    </div>
                  </div>
                  <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                    <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                      {printedCount}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider mt-1">
                      Impressos
                    </div>
                  </div>
                </div>

                {/* Recently printed badges */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    Crachás Impressos Recentemente
                  </h3>

                  {printedBadges.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl">
                      <Printer className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Aguardando check-ins...
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Os crachás serão impressos automaticamente
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {printedBadges.map((pb, index) => (
                        <div
                          key={pb.signup.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            index === 0
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30 animate-in fade-in slide-in-from-top-2'
                              : 'bg-card border-border/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{pb.signup.name}</p>
                              {pb.signup.product_name && (
                                <p className="text-xs text-muted-foreground">
                                  {pb.signup.product_name}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {pb.printedAt.toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleManualPrint(pb.signup)}
                              title="Reimprimir"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </FadeIn>
    </main>
  );
}
