'use client';

import { useMutation, useQuery } from '@apollo/client';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Package,
  Plus,
  Upload,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import { detectColumn, tableFromMatrix } from '@/lib/import-sheet';

import { FadeIn } from '@/components/animations';
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
import { useToast } from '@/hooks/use-toast';
import { GET_EVENT_BY_SLUG_OR_ID, IMPORT_SIGNUPS, MANUAL_SIGNUP } from '@/lib/queries';
import { EventResponse, ImportSignupsResponse, ManualSignupResponse } from '@/lib/types';

// ── Types ──
interface CSVRow {
  [key: string]: any;
}

interface ColumnMapping {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

interface BatchInfo {
  id: string;
  batch_number: number;
  value: number;
  enabled: boolean;
  product: {
    id: string;
    name: string;
    can_be_listed: boolean;
  };
}

// ── Doity auto-detect ──
const DOITY_NAME_COLUMNS = ['Nome', 'Nome Completo', 'name', 'Nome do participante', 'Participante'];
const DOITY_EMAIL_COLUMNS = ['E-mail', 'Email', 'email', 'E-mail do participante'];
const DOITY_PHONE_COLUMNS = ['Telefone', 'Celular', 'phone', 'WhatsApp', 'Telefone/Celular'];
const DOITY_CPF_COLUMNS = ['CPF', 'cpf', 'Cpf', 'Documento', 'CPF do participante'];

const autoDetectColumn = detectColumn;

// ── CPF mask ──
function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// ── Phone mask ──
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

type PageMode = 'select' | 'csv' | 'manual';

export default function ImportSignupsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Mode
  const [mode, setMode] = useState<PageMode>('select');

  // CSV State
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: '',
    email: '',
    phone: '',
    cpf: '',
  });
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportSignupsResponse['importSignups'] | null>(null);
  const [step, setStep] = useState<'upload' | 'batch' | 'map' | 'preview' | 'importing' | 'done'>('upload');

  // Manual signup state
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
  });
  const [manualBatchId, setManualBatchId] = useState<string>('');
  const [manualLoading, setManualLoading] = useState(false);
  const [recentSignups, setRecentSignups] = useState<
    { name: string; email: string; success: boolean; message: string; account_created: boolean }[]
  >([]);

  // Fetch event info with products and batches
  const { data: eventData, loading: eventLoading } = useQuery<EventResponse>(
    GET_EVENT_BY_SLUG_OR_ID,
    {
      variables: { slugOrId: id },
      skip: !id,
    }
  );

  const [importSignups] = useMutation<ImportSignupsResponse>(IMPORT_SIGNUPS);
  const [manualSignup] = useMutation<ManualSignupResponse>(MANUAL_SIGNUP);

  const event = eventData?.eventBySlugOrId;
  const eventTitle = event?.title || 'Evento';
  const eventSlug = event?.slug || id;

  // Extract all batches with their product info
  const allBatches: BatchInfo[] = (event?.products || []).flatMap((product: any) =>
    (product.batches || []).map((batch: any) => ({
      id: batch.id,
      batch_number: batch.batch_number,
      value: batch.value,
      enabled: batch.enabled,
      product: {
        id: product.id,
        name: product.name,
        can_be_listed: product.can_be_listed !== false,
      },
    }))
  );

  // ── CSV Handlers ──
  const onFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      try {
        let rows: CSVRow[] = [];
        let headerRow: string[] = [];

        const workbook = file.name.endsWith('.csv')
          ? XLSX.read(data as string, { type: 'string' })
          : XLSX.read(data as ArrayBuffer, { type: 'array' });

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

        // Headers and rows come from the same place on purpose — see
        // `tableFromMatrix`: reading them through two paths is what made a
        // Google Forms export import nobody at all.
        const table = tableFromMatrix(matrix);
        headerRow = table.headers;
        rows = table.rows as CSVRow[];

        setHeaders(headerRow);
        setCsvData(rows);

        const autoName = autoDetectColumn(headerRow, DOITY_NAME_COLUMNS);
        const autoEmail = autoDetectColumn(headerRow, DOITY_EMAIL_COLUMNS);
        const autoPhone = autoDetectColumn(headerRow, DOITY_PHONE_COLUMNS);
        const autoCpf = autoDetectColumn(headerRow, DOITY_CPF_COLUMNS);

        setMapping({ name: autoName, email: autoEmail, phone: autoPhone, cpf: autoCpf });
        setStep('batch');
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Erro ao processar o arquivo. Verifique se o formato está correto.');
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const getFullName = (row: CSVRow, nameCol: string) => {
    if (!nameCol) return '';
    const firstName = String(row[nameCol] || '').trim();
    if (!firstName) return '';
    const keys = Object.keys(row);
    const surnameKey = keys.find((k) => {
      const lower = k.toLowerCase().trim();
      return lower === 'sobrenome' || lower.includes('sobrenome') || lower === 'last name' || lower === 'surname';
    });
    let surname = '';
    if (surnameKey && surnameKey !== nameCol) {
      surname = String(row[surnameKey] || '').trim();
    }
    return surname ? `${firstName} ${surname}` : firstName;
  };

  const mappedData = csvData
    .map((row) => ({
      name: getFullName(row, mapping.name),
      email: mapping.email && mapping.email !== '__none' ? String(row[mapping.email] || '').trim() : '',
      phone_number: mapping.phone && mapping.phone !== '__none' ? String(row[mapping.phone] || '').trim() : '',
      cpf: mapping.cpf && mapping.cpf !== '__none' ? maskCPF(String(row[mapping.cpf] || '').trim()) : '',
    }))
    .filter((r) => r.name.trim() !== '');

  const selectedBatch = allBatches.find((b) => b.id === selectedBatchId);

  const handleImport = async () => {
    if (mappedData.length === 0 || !selectedBatchId) return;
    setStep('importing');
    try {
      const { data } = await importSignups({
        variables: {
          eventSlug,
          batchId: selectedBatchId,
          // `SignupImportInput` is name/email/phone only. The CPF is read from
          // the sheet and shown in the preview, but the signup record has no
          // field for it, and sending one GraphQL does not know rejects the
          // whole batch — all 35 people failed on a single unknown key.
          signups: mappedData.map((d) => ({
            name: d.name,
            email: d.email || null,
            phone_number: d.phone_number || null,
          })),
        },
      });
      if (data?.importSignups) setImportResult(data.importSignups);
      setStep('done');
    } catch (err: any) {
      setImportResult({
        success: false,
        message: `Erro: ${err.message}`,
        imported_count: 0,
        skipped_count: 0,
        errors: [err.message],
      });
      setStep('done');
    }
  };

  const handleReset = () => {
    setCsvData([]);
    setHeaders([]);
    setFileName('');
    setMapping({ name: '', email: '', phone: '', cpf: '' });
    setSelectedBatchId('');
    setImportResult(null);
    setStep('upload');
    setMode('select');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Manual Signup Handler ──
  const handleManualSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.name || !manualForm.email || !manualBatchId) return;

    setManualLoading(true);
    try {
      const { data } = await manualSignup({
        variables: {
          eventSlug,
          batchId: manualBatchId,
          input: {
            name: manualForm.name,
            email: manualForm.email,
            cpf: manualForm.cpf.replace(/\D/g, '') || null,
            phone_number: manualForm.phone || null,
          },
        },
      });

      const result = data?.manualSignup;
      setRecentSignups((prev) => [
        {
          name: manualForm.name,
          email: manualForm.email,
          success: result?.success ?? false,
          message: result?.message ?? '',
          account_created: result?.account_created ?? false,
        },
        ...prev,
      ]);

      if (result?.success) {
        toast({
          title: result.account_created ? '✅ Inscrito + Conta criada!' : '✅ Inscrito com sucesso!',
          description: result.message,
        });
        // Reset form but keep batch
        setManualForm({ name: '', email: '', cpf: '', phone: '' });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: result?.message || 'Erro ao inscrever.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: err.message || 'Erro ao inscrever.',
      });
    } finally {
      setManualLoading(false);
    }
  };

  if (eventLoading) {
    return (
      <div className="container mx-auto py-20 flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando evento...</p>
      </div>
    );
  }

  return (
    <FadeIn direction="up" duration={0.3}>
      <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => mode === 'select' ? router.back() : setMode('select')}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Gerenciar Inscrições
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              {eventTitle}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* Mode Select */}
        {/* ══════════════════════════════════════════════════ */}
        {mode === 'select' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CSV Import */}
            <button
              onClick={() => setMode('csv')}
              className="text-left bg-card border border-border rounded-2xl p-8 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-5 group-hover:bg-blue-500/15 transition-colors">
                <FileSpreadsheet className="w-7 h-7 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Importar CSV</h2>
              <p className="text-sm text-muted-foreground">
                Importe uma lista de participantes a partir de um arquivo CSV ou Excel (Doity, Sympla, etc.)
              </p>
            </button>

            {/* Manual Signup */}
            <button
              onClick={() => setMode('manual')}
              className="text-left bg-card border border-border rounded-2xl p-8 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5 group-hover:bg-emerald-500/15 transition-colors">
                <UserPlus className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Inscrição Manual</h2>
              <p className="text-sm text-muted-foreground">
                Inscreva um participante manualmente. Uma conta no HubCommunity será criada automaticamente.
              </p>
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* Manual Signup Mode */}
        {/* ══════════════════════════════════════════════════ */}
        {mode === 'manual' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Form */}
            <div className="lg:col-span-3 space-y-6">
              {/* Batch selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Produto/Lote
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {allBatches.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed rounded-xl">
                      <p className="text-sm text-muted-foreground mb-3">Nenhum lote encontrado.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/events/${id}#products`)}
                        className="gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Criar no evento
                      </Button>
                    </div>
                  ) : (
                    <Select value={manualBatchId} onValueChange={setManualBatchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {allBatches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.product.name} — {batch.batch_number}º Lote
                            {!batch.product.can_be_listed ? ' (Oculto)' : ''}
                            {batch.value > 0 ? ` — R$ ${(batch.value / 100).toFixed(2)}` : ' — Gratuito'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardContent>
              </Card>

              {/* Person form */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-primary" />
                    Dados do Participante
                  </CardTitle>
                  <CardDescription>
                    Preencha os dados. Se o e-mail não existir no HubCommunity, uma conta será criada automaticamente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleManualSignup} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>
                          Nome completo <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          placeholder="João da Silva"
                          value={manualForm.name}
                          onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          E-mail <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="email"
                          placeholder="joao@email.com"
                          value={manualForm.email}
                          onChange={(e) => setManualForm((f) => ({ ...f, email: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CPF</Label>
                        <Input
                          placeholder="000.000.000-00"
                          value={manualForm.cpf}
                          onChange={(e) =>
                            setManualForm((f) => ({ ...f, cpf: maskCPF(e.target.value) }))
                          }
                          maxLength={14}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>WhatsApp</Label>
                        <Input
                          placeholder="(00) 00000-0000"
                          value={manualForm.phone}
                          onChange={(e) =>
                            setManualForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))
                          }
                          maxLength={15}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={
                        manualLoading ||
                        !manualForm.name ||
                        !manualForm.email ||
                        !manualBatchId
                      }
                      className="w-full gap-2"
                    >
                      {manualLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Inscrevendo...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Inscrever Participante
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Recent signups sidebar */}
            <div className="lg:col-span-2">
              <Card className="sticky top-8">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Inscrições recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentSignups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhuma inscrição realizada ainda.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {recentSignups.map((signup, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-xl border text-sm ${
                            signup.success
                              ? 'bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-950/10 dark:border-emerald-800/30'
                              : 'bg-destructive/5 border-destructive/20'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {signup.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate">{signup.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{signup.email}</p>
                              {signup.account_created && (
                                <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                                  Conta criada
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* CSV Import Mode */}
        {/* ══════════════════════════════════════════════════ */}
        {mode === 'csv' && (
          <>
            {/* Step indicators */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {[
                { key: 'upload', label: '1. Upload' },
                { key: 'batch', label: '2. Lote' },
                { key: 'map', label: '3. Colunas' },
                { key: 'preview', label: '4. Prévia' },
              ].map(({ key, label }, index) => {
                const steps = ['upload', 'batch', 'map', 'preview', 'importing', 'done'];
                const currentIndex = steps.indexOf(step);
                const stepIndex = steps.indexOf(key);
                const isActive = stepIndex === currentIndex;
                const isDone = stepIndex < currentIndex;

                return (
                  <div key={key} className="flex items-center gap-2">
                    {index > 0 && <div className="w-6 h-px bg-border" />}
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isDone
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3 inline mr-1" /> : null}
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CSV Upload */}
            {step === 'upload' && (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2">Upload do CSV</h2>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                    Exporte a lista de participantes em formato CSV ou Excel e faça o upload aqui.
                  </p>
                  <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Selecionar Arquivo
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onFileUpload}
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                  />
                </CardContent>
              </Card>
            )}

            {/* Batch Selection */}
            {step === 'batch' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Selecionar Produto/Lote
                  </CardTitle>
                  <CardDescription>
                    Escolha em qual produto e lote as inscrições importadas serão vinculadas.
                    <span className="block mt-1 text-xs">
                      💡 Dica: Crie um produto com <strong>&quot;Listável&quot; desativado</strong> para que ele não apareça na página pública.
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {allBatches.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl">
                      <Package className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Nenhum produto/lote encontrado
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/admin/events/${id}#products`)}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Ir para edição do evento
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allBatches.map((batch) => {
                        const isSelected = selectedBatchId === batch.id;
                        const isHidden = !batch.product.can_be_listed;
                        return (
                          <button
                            key={batch.id}
                            onClick={() => setSelectedBatchId(batch.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                              isSelected
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{batch.product.name}</p>
                                {isHidden && (
                                  <span className="text-[10px] uppercase font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                                    Oculto
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {batch.batch_number}º Lote
                                {batch.value > 0 ? ` — R$ ${(batch.value / 100).toFixed(2)}` : ' — Gratuito'}
                              </p>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {allBatches.length > 0 && (
                    <div className="flex justify-between items-center mt-6">
                      <Button variant="outline" onClick={handleReset}>Cancelar</Button>
                      <Button disabled={!selectedBatchId} onClick={() => setStep('map')}>
                        Continuar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Column Mapping */}
            {step === 'map' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    Mapeamento de Colunas
                  </CardTitle>
                  <CardDescription>
                    📄 {fileName} — {csvData.length} registro{csvData.length !== 1 ? 's' : ''}
                    {selectedBatch && (
                      <> · Lote: <strong>{selectedBatch.product.name} — {selectedBatch.batch_number}º Lote</strong></>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Nome <span className="text-destructive">*</span>
                      </Label>
                      <Select value={mapping.name} onValueChange={(v) => setMapping((m) => ({ ...m, name: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
                        <SelectContent>
                          {headers.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      {mapping.name && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> Auto-detectado</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Select value={mapping.email} onValueChange={(v) => setMapping((m) => ({ ...m, email: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— Nenhum —</SelectItem>
                          {headers.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Select value={mapping.phone} onValueChange={(v) => setMapping((m) => ({ ...m, phone: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— Nenhum —</SelectItem>
                          {headers.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Select value={mapping.cpf} onValueChange={(v) => setMapping((m) => ({ ...m, cpf: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— Nenhum —</SelectItem>
                          {headers.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-8">
                    <Button variant="outline" onClick={() => setStep('batch')}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                    <Button disabled={!mapping.name} onClick={() => setStep('preview')} className="gap-2">
                      <Users className="w-4 h-4" /> Visualizar ({mappedData.length})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preview */}
            {step === 'preview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 p-4 rounded-xl border border-border/50 text-center">
                    <div className="text-2xl font-bold">{mappedData.length}</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-1">Total</div>
                  </div>
                  <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-center">
                    <div className="text-2xl font-bold text-blue-700">{mappedData.filter((d) => d.email).length}</div>
                    <div className="text-[10px] uppercase font-bold text-blue-600 tracking-wider mt-1">Com e-mail</div>
                  </div>
                  <div className="bg-purple-500/10 p-4 rounded-xl border border-purple-500/20 text-center">
                    <div className="text-2xl font-bold text-purple-700">{mappedData.filter((d) => d.phone_number).length}</div>
                    <div className="text-[10px] uppercase font-bold text-purple-600 tracking-wider mt-1">Com telefone</div>
                  </div>
                  <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 text-center">
                    <div className="text-2xl font-bold text-amber-700">{selectedBatch?.product.name || '—'}</div>
                    <div className="text-[10px] uppercase font-bold text-amber-600 tracking-wider mt-1">Lote destino</div>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Prévia dos Dados</CardTitle>
                    <CardDescription>
                      Confirme os dados. Duplicados por e-mail serão ignorados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-hidden max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>CPF</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mappedData.slice(0, 100).map((row, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.email || '—'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.phone_number || '—'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{row.cpf || '—'}</TableCell>
                            </TableRow>
                          ))}
                          {mappedData.length > 100 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-3">
                                ... e mais {mappedData.length - 100} registros
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-between items-center mt-6">
                      <Button variant="outline" onClick={() => setStep('map')} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Voltar
                      </Button>
                      <Button onClick={handleImport} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <Download className="w-4 h-4" /> Importar {mappedData.length} Inscrições
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Importing */}
            {step === 'importing' && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
                    <Loader2 className="w-12 h-12 animate-spin text-primary relative" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2">Importando inscrições...</h2>
                  <p className="text-sm text-muted-foreground">
                    Importando {mappedData.length} inscrições para <strong>{eventTitle}</strong>.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Done */}
            {step === 'done' && importResult && (
              <Card
                className={
                  importResult.success
                    ? 'border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-800/30 dark:bg-emerald-950/10'
                    : 'border-destructive/30 bg-destructive/5'
                }
              >
                <CardContent className="flex flex-col items-center justify-center py-12">
                  {importResult.success ? (
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-destructive/15 flex items-center justify-center mb-6">
                      <XCircle className="w-8 h-8 text-destructive" />
                    </div>
                  )}
                  <h2 className="text-lg font-semibold mb-2">
                    {importResult.success ? 'Importação Concluída!' : 'Erro na Importação'}
                  </h2>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                    {importResult.message}
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-6 w-full max-w-sm">
                    <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                      <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{importResult.imported_count}</div>
                      <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider mt-1">Importados</div>
                    </div>
                    <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 text-center">
                      <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{importResult.skipped_count}</div>
                      <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider mt-1">Ignorados</div>
                    </div>
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="w-full max-w-md bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm font-medium text-destructive">
                          {importResult.errors.length} erro{importResult.errors.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="max-h-[150px] overflow-y-auto space-y-1">
                        {importResult.errors.map((err, i) => (
                          <p key={i} className="text-xs text-destructive/80">{err}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleReset} className="gap-2">
                      <Upload className="w-4 h-4" /> Nova Importação
                    </Button>
                    <Button onClick={() => router.push(`/badge-printer/live/${eventSlug}`)} className="gap-2">
                      <Users className="w-4 h-4" /> Credenciamento
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </FadeIn>
  );
}
