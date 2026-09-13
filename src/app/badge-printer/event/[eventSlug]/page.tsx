'use client';

import { useMutation, useQuery } from '@apollo/client';
import { Check, Loader2, Printer, RefreshCw, Search, UserPlus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FadeIn } from '@/components/animations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { printBadge } from '@/lib/badge-print';
import { formatCpf } from '@/lib/certificate';
import { CHECKIN_SIGNUP, EVENT_BATCHES, EVENT_SIGNUPS, MANUAL_SIGNUP } from '@/lib/queries';
import type {
  CheckinResponse,
  EventBatchesResponse,
  EventSignup,
  EventSignupsResponse,
  ManualSignupResponse,
} from '@/lib/types';

// Reception settings survive reloads and are per event.
const settingsKey = (slug: string) => `badge-printer-event-v1:${slug}`;

interface Settings {
  eventName: string;
  link: string;
  batchId: string;
}

const DEFAULT_SETTINGS: Settings = { eventName: 'COMUNIDADE', link: 'https://hubcommunity.io', batchId: '' };

const loadSettings = (slug: string): Settings => {
  try {
    const raw = localStorage.getItem(settingsKey(slug));
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

interface WalkIn {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

const EMPTY_WALK_IN: WalkIn = { name: '', email: '', phone: '', cpf: '' };

/**
 * Badge printing fed by the event's signups over plain HTTP — for venues where the
 * WebSocket behind the live printer is blocked. Printing a badge checks the person in,
 * so "already printed" lives on the server and is shared by every machine at reception.
 * Walk-ins are registered on the spot (account + free signup) and printed right away.
 */
export default function EventBadgePrinterPage() {
  const params = useParams();
  const eventSlug = params?.eventSlug as string;

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkIn, setWalkIn] = useState<WalkIn>(EMPTY_WALK_IN);
  const [walkInError, setWalkInError] = useState('');
  const [walkInBusy, setWalkInBusy] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eventSlug) setSettings(loadSettings(eventSlug));
  }, [eventSlug]);

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(settingsKey(eventSlug), JSON.stringify(next));
      } catch {
        // storage unavailable: settings just won't persist
      }
      return next;
    });
  };

  const { data, loading, error, refetch } = useQuery<EventSignupsResponse>(EVENT_SIGNUPS, {
    variables: { eventSlug },
    skip: !eventSlug,
    fetchPolicy: 'network-only',
    pollInterval: 60_000,
  });

  const { data: eventData } = useQuery<EventBatchesResponse>(EVENT_BATCHES, {
    variables: { slugOrId: eventSlug },
    skip: !eventSlug,
  });

  const [checkinSignup] = useMutation<CheckinResponse>(CHECKIN_SIGNUP);
  const [manualSignup] = useMutation<ManualSignupResponse>(MANUAL_SIGNUP);

  const batches = useMemo(
    () =>
      (eventData?.eventBySlugOrId?.products || [])
        .filter((p) => p.enabled)
        .flatMap((p) =>
          (p.batches || [])
            .filter((b) => b.enabled)
            .map((b) => ({ id: String(b.id), label: `${p.name} — Lote ${b.batch_number}${b.value ? ` (R$ ${b.value})` : ' (gratuito)'}` })),
        ),
    [eventData],
  );
  const selectedBatchId = batches.some((b) => b.id === settings.batchId) ? settings.batchId : batches[0]?.id ?? '';

  const signups = data?.eventSignups || [];
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return signups;
    return signups.filter(
      (s) => s.name.toLowerCase().includes(term) || (s.email || '').toLowerCase().includes(term),
    );
  }, [signups, searchTerm]);
  const checkedInCount = signups.filter((s) => s.checked_in).length;

  // Print, then check in (the server-side "printed" mark). Failures to check in are
  // logged but never undo a badge that already came out of the printer.
  const printAndCheckin = useCallback(
    async (signup: EventSignup) => {
      setPrintingId(signup.id);
      try {
        const qrDataUrl = qrRef.current?.querySelector('canvas')?.toDataURL() || '';
        await printBadge({ fullName: signup.name, qrDataUrl, logoText: settings.eventName, link: settings.link });
        if (!signup.checked_in) {
          await checkinSignup({ variables: { eventSlug, signupId: signup.id } });
          await refetch();
        }
      } catch (err) {
        console.error('Print/check-in error:', err);
      } finally {
        setPrintingId(null);
      }
    },
    [checkinSignup, eventSlug, refetch, settings.eventName, settings.link],
  );

  const handleWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkInError('');
    if (walkIn.name.trim().length < 3 || !walkIn.email.trim()) {
      setWalkInError('Informe nome completo e e-mail.');
      return;
    }
    if (!selectedBatchId) {
      setWalkInError('Este evento não tem lote disponível para inscrição.');
      return;
    }
    setWalkInBusy(true);
    try {
      const input: Record<string, string> = { name: walkIn.name.trim(), email: walkIn.email.trim().toLowerCase() };
      if (walkIn.phone.trim()) input.phone_number = walkIn.phone.trim();
      if (walkIn.cpf.trim()) input.cpf = walkIn.cpf.trim();
      const { data: result } = await manualSignup({ variables: { eventSlug, batchId: selectedBatchId, input } });
      const response = result?.manualSignup;
      if (!response?.success || !response.signup) {
        setWalkInError(response?.message || 'Não foi possível inscrever. Tente novamente.');
        return;
      }
      setWalkInOpen(false);
      setWalkIn(EMPTY_WALK_IN);
      await printAndCheckin(response.signup);
    } catch (err) {
      setWalkInError(err instanceof Error ? err.message : 'Não foi possível inscrever. Tente novamente.');
    } finally {
      setWalkInBusy(false);
    }
  };

  return (
    <main className="container mx-auto py-10 px-4 min-h-screen">
      {/* Hidden QR for the badge (static link, same as the CSV printer) */}
      <div ref={qrRef} className="hidden">
        <QRCodeCanvas value={settings.link || 'https://hubcommunity.io'} size={256} level="H" />
      </div>

      <FadeIn direction="up" duration={0.3}>
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Crachás — {eventData?.eventBySlugOrId?.title || eventSlug}
              </h1>
              <p className="text-muted-foreground">
                Inscritos direto do servidor. Imprimir o crachá faz o check-in da pessoa.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => refetch()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Dialog
                open={walkInOpen}
                onOpenChange={(open) => {
                  setWalkInOpen(open);
                  if (!open) setWalkInError('');
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Credenciar na hora
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleWalkIn} noValidate>
                    <DialogHeader>
                      <DialogTitle>Credenciar na hora</DialogTitle>
                      <DialogDescription>
                        Inscreve a pessoa no evento, imprime o crachá e envia um e-mail para ela
                        definir a senha e concluir o cadastro no HubCommunity.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="walkin-name">Nome completo</Label>
                        <Input
                          id="walkin-name"
                          autoComplete="off"
                          value={walkIn.name}
                          onChange={(e) => setWalkIn((w) => ({ ...w, name: e.target.value }))}
                          disabled={walkInBusy}
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="walkin-email">E-mail</Label>
                        <Input
                          id="walkin-email"
                          type="email"
                          autoComplete="off"
                          value={walkIn.email}
                          onChange={(e) => setWalkIn((w) => ({ ...w, email: e.target.value }))}
                          disabled={walkInBusy}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="walkin-phone">WhatsApp (opcional)</Label>
                          <Input
                            id="walkin-phone"
                            inputMode="tel"
                            placeholder="+55 62 99999-9999"
                            value={walkIn.phone}
                            onChange={(e) => setWalkIn((w) => ({ ...w, phone: e.target.value }))}
                            disabled={walkInBusy}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="walkin-cpf">CPF (opcional)</Label>
                          <Input
                            id="walkin-cpf"
                            inputMode="numeric"
                            placeholder="000.000.000-00"
                            maxLength={14}
                            value={walkIn.cpf}
                            onChange={(e) => setWalkIn((w) => ({ ...w, cpf: formatCpf(e.target.value) }))}
                            disabled={walkInBusy}
                          />
                        </div>
                      </div>
                      {batches.length > 1 && (
                        <div className="space-y-2">
                          <Label htmlFor="walkin-batch">Lote</Label>
                          <Select value={selectedBatchId} onValueChange={(v) => updateSettings({ batchId: v })}>
                            <SelectTrigger id="walkin-batch">
                              <SelectValue placeholder="Selecione o lote" />
                            </SelectTrigger>
                            <SelectContent>
                              {batches.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {walkInError && <p className="text-sm text-destructive">{walkInError}</p>}
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setWalkInOpen(false)} disabled={walkInBusy}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={walkInBusy}>
                        {walkInBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
                        Inscrever e imprimir
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Configuração do crachá</CardTitle>
              <CardDescription>Texto e link do QR impressos em todos os crachás deste evento.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="badge-event-name">Nome do Evento/Comunidade</Label>
                <Input
                  id="badge-event-name"
                  value={settings.eventName}
                  onChange={(e) => updateSettings({ eventName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge-link">Link do QR Code</Label>
                <Input
                  id="badge-link"
                  value={settings.link}
                  onChange={(e) => updateSettings({ link: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Inscritos</CardTitle>
                  <CardDescription>
                    {checkedInCount} de {signups.length} credenciados
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <p className="text-sm text-destructive mb-4">Erro ao carregar inscritos: {error.message}</p>
              )}
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                      <TableHead className="hidden sm:table-cell">Produto</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[80px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id} className={s.checked_in ? 'bg-muted/50 text-muted-foreground' : ''}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="hidden sm:table-cell">{s.email || '—'}</TableCell>
                        <TableCell className="hidden sm:table-cell">{s.product_name || '—'}</TableCell>
                        <TableCell>
                          {s.checked_in ? (
                            <Badge variant="secondary" className="gap-1">
                              <Check className="w-3 h-3 text-emerald-600" /> Credenciado
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Pendente</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Imprimir crachá"
                            aria-label={`Imprimir crachá de ${s.name}`}
                            disabled={printingId === s.id}
                            onClick={() => printAndCheckin(s)}
                          >
                            {printingId === s.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Printer className={`w-4 h-4 ${s.checked_in ? 'text-emerald-600' : ''}`} />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {searchTerm ? 'Nenhum inscrito encontrado para a busca.' : 'Nenhum inscrito ainda.'}
                        </TableCell>
                      </TableRow>
                    )}
                    {loading && signups.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin inline" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>
    </main>
  );
}
