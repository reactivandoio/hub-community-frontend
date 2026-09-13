'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { AlertTriangle, Download, Loader2, Mail, Pencil, RefreshCw, Send } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { formatCpf, formatDate, isValidCpf, normalizeIdentifier } from '@/lib/certificate';
import { GET_CERTIFICATE_CANDIDATES, ISSUE_CERTIFICATES } from '@/lib/queries';
import type { CandidateSource, CertificateCandidate, CertificateCandidatesResponse, IssueCertificatesResponse, IssueEntryInput } from '@/lib/types';

const SOURCE_LABEL: Record<CandidateSource, string> = { SIGNUP: 'Inscrito', ATTENDANCE: 'Presença', REQUEST: 'Solicitação' };
type StatusFilter = 'all' | 'pending' | 'issued' | 'sent';
const ZIP_BATCH = 500;

// Same pattern as src/app/certificado/page.tsx: prefer the BFF's GraphQL error, fall back to a
// generic pt-BR message for network errors.
function errorMessage(err: unknown): string {
  const graphQLErrors = (err as { graphQLErrors?: { message: string }[] } | undefined)?.graphQLErrors;
  if (graphQLErrors?.length) return graphQLErrors[0].message;
  return 'Não foi possível conectar. Tente novamente.';
}

interface RowEdit { name?: string; identifier?: string }
interface IssueOptions { register: boolean; email: boolean; zip: boolean }

// Same rule the BFF applies before falling back to the e-mail as identifier.
const hasValidEmail = (email?: string | null) => (email || '').trim().includes('@');

interface Props {
  eventId: string;
  eventSlug: string;
}

export function CertificateIssueTable({ eventId, eventSlug }: Props) {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useQuery<CertificateCandidatesResponse>(GET_CERTIFICATE_CANDIDATES, {
    variables: { eventId },
    fetchPolicy: 'network-only',
  });
  const [issue, { loading: issuing }] = useMutation<IssueCertificatesResponse>(ISSUE_CERTIFICATES);

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | CandidateSource>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actions, setActions] = useState<IssueOptions>({ register: true, email: false, zip: false });
  const [lastOptions, setLastOptions] = useState<IssueOptions>({ register: true, email: false, zip: false });
  const [zipping, setZipping] = useState(false);

  const candidates = data?.certificateCandidates ?? [];

  const effective = (c: CertificateCandidate) => ({
    name: edits[c.key]?.name ?? c.name,
    identifier: normalizeIdentifier(edits[c.key]?.identifier ?? c.identifier ?? ''),
    email: (c.email || '').trim(),
  });

  // Mirrors the BFF's `(entry.name || '').trim() || entry.email || cpf` label used to prefix
  // each error string (see hub-community-bff Certificate resolver, issueCertificates loop).
  const labelFor = (entry: { name: string; identifier?: string; email: string }) =>
    (entry.name || '').trim() || entry.email || entry.identifier || '';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return candidates.filter((c) => {
      const name = (edits[c.key]?.name ?? c.name).toLowerCase();
      if (term && !name.includes(term) && !(c.email || '').includes(term)) return false;
      if (sourceFilter !== 'all' && !c.sources.includes(sourceFilter)) return false;
      if (statusFilter === 'pending' && c.certificate) return false;
      if (statusFilter === 'issued' && !c.certificate) return false;
      if (statusFilter === 'sent' && !c.certificate?.sent_at) return false;
      return true;
    });
  }, [candidates, search, sourceFilter, statusFilter, edits]);

  // A CPF is optional (the BFF keys the certificate by e-mail when there is none), but whatever
  // was typed in the CPF field must be a valid CPF.
  const canIssue = (c: CertificateCandidate) => {
    const eff = effective(c);
    return hasValidEmail(eff.email) && (isValidCpf(eff.identifier) || !eff.identifier);
  };
  const selectable = filtered.filter((c) => canIssue(c) || c.certificate);
  const allFilteredSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.key));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) selectable.forEach((c) => next.delete(c.key));
    else selectable.forEach((c) => next.add(c.key));
    setSelected(next);
  };
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };
  const setEdit = (key: string, patch: RowEdit) => setEdits({ ...edits, [key]: { ...edits[key], ...patch } });

  const downloadZip = async (codes: string[]) => {
    if (codes.length === 0) {
      toast({ variant: 'destructive', title: 'ZIP falhou', description: 'Nenhum dos selecionados tem certificado emitido.' });
      return;
    }
    setZipping(true);
    try {
      const token = localStorage.getItem('auth_token') || '';
      for (let i = 0; i < codes.length; i += ZIP_BATCH) {
        const res = await fetch('/api/certificates/zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ codes: codes.slice(i, i + ZIP_BATCH) }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao gerar o ZIP.');
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement('a');
        a.href = url;
        a.download = codes.length > ZIP_BATCH ? `certificados-${eventSlug}-${i / ZIP_BATCH + 1}.zip` : `certificados-${eventSlug}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'ZIP falhou', description: err instanceof Error ? err.message : 'Erro' });
    } finally {
      setZipping(false);
    }
  };

  const runIssue = async (targets: CertificateCandidate[], opts: IssueOptions, extraZipTargets: CertificateCandidate[] = []) => {
    const entries: IssueEntryInput[] = targets.map((c) => {
      const { name, identifier: cpf, email } = effective(c);
      return { name, identifier: isValidCpf(cpf) ? normalizeIdentifier(cpf) : undefined, email };
    });
    try {
      const { data: res } = await issue({ variables: { eventId, entries, actions: { register: opts.register, email: opts.email } } });
      const result = res?.issueCertificates;
      if (!result) return;

      // BFF errors are labelled `${label}: ${msg}` where label = trimmed name -> email -> CPF
      // (see hub-community-bff Certificate resolver). Match on that prefix, preferring the
      // longest label when more than one target could match, and strip the prefix for display.
      const rows = targets.map((c, i) => ({ key: c.key, label: labelFor(entries[i]) }));
      const matched: Record<string, string> = {};
      result.errors.forEach((msg) => {
        let bestKey: string | null = null;
        let bestLabel = '';
        rows.forEach((row) => {
          const prefix = `${row.label}: `;
          if (msg.startsWith(prefix) && row.label.length > bestLabel.length) {
            bestKey = row.key;
            bestLabel = row.label;
          }
        });
        if (bestKey) matched[bestKey] = msg.slice(bestLabel.length + 2);
      });
      setRowErrors((prev) => {
        const next = { ...prev };
        targets.forEach((c) => delete next[c.key]);
        Object.assign(next, matched);
        return next;
      });

      toast({
        title: 'Emissão concluída',
        description: `${result.issued} registrado(s), ${result.emailed} e-mail(s) enviado(s)${result.errors.length ? `, ${result.errors.length} erro(s)` : ''}.`,
        variant: result.errors.length ? 'destructive' : undefined,
      });

      if (opts.zip) {
        const codes = new Set(result.certificates.map((c) => c.code));
        extraZipTargets.forEach((c) => c.certificate?.code && codes.add(c.certificate.code));
        await downloadZip(Array.from(codes));
      }
      setSelected(new Set());
      setEdits((prev) => {
        const next = { ...prev };
        // Keep edits for rows that came back with a matched error so a retry doesn't lose
        // the user's corrections (e.g. a fixed CPF that still failed for another reason).
        targets.filter((c) => !matched[c.key]).forEach((c) => delete next[c.key]);
        return next;
      });
      await refetch();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro na emissão', description: err instanceof Error ? err.message : 'Erro' });
    }
  };

  const confirmIssue = async () => {
    setDialogOpen(false);
    setLastOptions(actions);
    const targets = candidates.filter((c) => selected.has(c.key));
    if (!actions.register) {
      // ZIP only: include the rows that already have a certificate.
      const codes = targets.map((c) => c.certificate?.code).filter((code): code is string => Boolean(code));
      await downloadZip(codes);
      return;
    }
    const issuable = targets.filter(canIssue);
    // Selected rows that already have a certificate but no longer pass canIssue (e.g. no
    // e-mail, or an edited CPF became invalid): the mutation can't touch them, but a ZIP
    // export should still include their existing certificate.
    const alreadyIssuedSkipped = targets.filter((c) => !canIssue(c) && c.certificate);
    if (issuable.length === 0) {
      if (actions.zip) {
        const codes = alreadyIssuedSkipped.map((c) => c.certificate?.code).filter((code): code is string => Boolean(code));
        await downloadZip(codes);
      }
      return;
    }
    await runIssue(issuable, actions, alreadyIssuedSkipped);
  };

  const exportXlsx = () => {
    const rows = filtered.map((c) => ({
      Nome: effective(c).name,
      CPF: formatCpf(effective(c).identifier),
      'E-mail': c.email || '',
      WhatsApp: c.phone || '',
      Origem: c.sources.map((s) => SOURCE_LABEL[s]).join(', '),
      'Check-in': c.checked_in ? 'Sim' : 'Não',
      Código: c.certificate?.code || '',
      'Emitido em': c.certificate?.issued_at ? formatDate(c.certificate.issued_at) : '',
      'Enviado em': c.certificate?.sent_at ? formatDate(c.certificate.sent_at) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Certificados');
    XLSX.writeFile(wb, `certificados-${eventSlug}.xlsx`);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error) return <div className="text-red-500 bg-red-500/10 p-4 rounded-lg">{errorMessage(error)}</div>;

  const selectedCount = selected.size;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <CardTitle>Participantes ({candidates.length})</CardTitle>
              <CardDescription>Inscritos, presenças e solicitações, sem duplicar. Selecione e emita.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
              <Button variant="outline" onClick={exportXlsx} disabled={filtered.length === 0}><Download className="w-4 h-4 mr-2" />XLSX</Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as 'all' | CandidateSource)}>
              <SelectTrigger className="sm:w-44"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="SIGNUP">Inscritos</SelectItem>
                <SelectItem value="ATTENDANCE">Presença</SelectItem>
                <SelectItem value="REQUEST">Solicitação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Não emitidos</SelectItem>
                <SelectItem value="issued">Emitidos</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label="Selecionar todos" /></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum participante.</TableCell></TableRow>
                ) : filtered.map((c) => {
                  const eff = effective(c);
                  const editable = !c.certificate;
                  const cpfInvalid = Boolean(eff.identifier) && !isValidCpf(eff.identifier);
                  return (
                    <TableRow key={c.key} className={rowErrors[c.key] ? 'bg-destructive/5' : undefined}>
                      <TableCell>
                        <Checkbox checked={selected.has(c.key)} disabled={!canIssue(c) && !c.certificate} onCheckedChange={() => toggle(c.key)} aria-label={`Selecionar ${eff.name}`} />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {editable ? (
                          <Input value={eff.name} className="h-8 min-w-48" onChange={(e) => setEdit(c.key, { name: e.target.value })} />
                        ) : eff.name}
                        {eff.name !== c.name ? <div className="text-xs text-muted-foreground">{c.name}</div> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {editable ? (
                          <Input value={formatCpf(eff.identifier)} placeholder="CPF (opcional)" className={`h-8 w-36 ${cpfInvalid ? 'border-destructive' : ''}`} onChange={(e) => setEdit(c.key, { identifier: e.target.value })} />
                        ) : formatCpf(eff.identifier)}
                        {!eff.identifier && eff.email ? <div className="text-xs text-muted-foreground">Sem CPF: emitido pelo e-mail</div> : null}
                      </TableCell>
                      <TableCell>{c.email || <span className="text-destructive text-xs">sem e-mail</span>}</TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap">
                        {c.sources.map((s) => <Badge key={s} variant="secondary">{SOURCE_LABEL[s]}</Badge>)}
                        {c.sources.length === 0 ? <Badge variant="outline">Auto-atendimento</Badge> : null}
                      </TableCell>
                      <TableCell>{c.checked_in ? 'Sim' : '-'}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {!c.certificate ? <span className="text-muted-foreground">Não emitido</span>
                          : c.certificate.sent_at ? <span className="text-green-600">Enviado {formatDate(c.certificate.sent_at)}</span>
                          : <span>Emitido {c.certificate.issued_at ? formatDate(c.certificate.issued_at) : ''}</span>}
                      </TableCell>
                      <TableCell>
                        {rowErrors[c.key] ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => runIssue([c], lastOptions)} aria-label="Tentar de novo" disabled={issuing}>
                                <AlertTriangle className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{rowErrors[c.key]}. Clique para tentar de novo.</TooltipContent>
                          </Tooltip>
                        ) : c.certificate ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => runIssue([c], { register: true, email: true, zip: false })} aria-label="Reenviar e-mail" disabled={issuing || !c.email}>
                                <Mail className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reenviar e-mail</TooltipContent>
                          </Tooltip>
                        ) : <Pencil className="w-4 h-4 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedCount > 0 ? (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-lg border bg-background p-3 shadow-lg">
          <span className="text-sm">{selectedCount} selecionado(s)</span>
          <Button onClick={() => setDialogOpen(true)} disabled={issuing || zipping}>
            {issuing || zipping ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Emitir
          </Button>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir {selectedCount} certificado(s)</DialogTitle>
            <DialogDescription>Escolha o que fazer com os selecionados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <Checkbox checked={actions.register} onCheckedChange={(v) => setActions({ ...actions, register: Boolean(v), email: Boolean(v) && actions.email })} />
              <div><Label>Registrar</Label><p className="text-xs text-muted-foreground">Cria o certificado (idempotente: quem já tem mantém o mesmo código).</p></div>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={actions.email} onCheckedChange={(v) => setActions({ ...actions, email: Boolean(v), register: actions.register || Boolean(v) })} />
              <div><Label>Enviar e-mail</Label><p className="text-xs text-muted-foreground">Link para baixar. Reenvia para quem já recebeu.</p></div>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox checked={actions.zip} onCheckedChange={(v) => setActions({ ...actions, zip: Boolean(v) })} />
              <div><Label>Baixar ZIP</Label><p className="text-xs text-muted-foreground">Um PDF por pessoa. Sem "Registrar", só inclui quem já tem certificado.</p></div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmIssue} disabled={!actions.register && !actions.zip}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
