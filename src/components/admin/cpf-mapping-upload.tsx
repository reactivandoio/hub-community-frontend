'use client';

import { useMutation } from '@apollo/client';
import { FileSpreadsheet, IdCard, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  CPF_STATUS_LABELS,
  type CpfMappingColumns,
  cpfMappingRows,
  detectCpfMappingColumns,
} from '@/lib/cpf-mapping';
import { tableFromMatrix, type SheetRow } from '@/lib/import-sheet';
import { UPDATE_CPFS } from '@/lib/queries';
import { UpdateCpfsResponse } from '@/lib/types';

const NONE = '__none';

/**
 * Spreadsheet → CPF on each participant's HubCommunity account, matched by
 * e-mail. The CPF is not per event: it lives on the account.
 */
export function CpfMappingUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [columns, setColumns] = useState<CpfMappingColumns>({ email: '', cpf: '', name: '' });
  const [result, setResult] = useState<UpdateCpfsResponse['updateCpfs'] | null>(null);
  const [error, setError] = useState('');
  const [updateCpfs, { loading }] = useMutation<UpdateCpfsResponse>(UPDATE_CPFS);

  const mapped = columns.email && columns.cpf ? cpfMappingRows(rows, columns) : [];

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = file.name.endsWith('.csv')
          ? XLSX.read(data as string, { type: 'string' })
          : XLSX.read(data as ArrayBuffer, { type: 'array' });
        const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
          header: 1,
          defval: '',
        }) as unknown[][];
        const table = tableFromMatrix(matrix);
        setHeaders(table.headers);
        setRows(table.rows);
        setColumns(detectCpfMappingColumns(table.headers));
      } catch {
        setError('Não foi possível ler o arquivo. Use CSV ou Excel.');
      }
    };
    if (file.name.endsWith('.csv')) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  };

  const submit = async () => {
    setError('');
    try {
      const { data } = await updateCpfs({ variables: { rows: mapped } });
      setResult(data?.updateCpfs ?? null);
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar os CPFs.');
    }
  };

  const columnSelect = (key: keyof CpfMappingColumns, label: string, optional = false) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={columns[key] || NONE}
        onValueChange={(value) => setColumns((c) => ({ ...c, [key]: value === NONE ? '' : value }))}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value={NONE}>Nenhuma</SelectItem>}
          {headers.filter(Boolean).map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const notSaved = result?.items.filter((item) => !['SAVED', 'CREATED', 'UNCHANGED'].includes(item.status)) ?? [];

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <IdCard className="w-4 h-4 text-primary" />
          Atualizar CPFs
        </CardTitle>
        <CardDescription>
          Envie uma planilha com e-mail e CPF. O CPF é gravado na conta do participante (casado pelo
          e-mail); quem não tem conta ganha uma, sem receber e-mail. Um CPF que a conta já tem nunca é
          sobrescrito.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={onFile}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
          <Upload className="w-4 h-4" />
          {fileName ? 'Trocar arquivo' : 'Escolher planilha'}
        </Button>
        {fileName && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {fileName} — {rows.length} linhas
          </p>
        )}

        {headers.length > 0 && !result && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {columnSelect('email', 'Coluna do e-mail')}
              {columnSelect('cpf', 'Coluna do CPF')}
              {columnSelect('name', 'Coluna do nome (para contas novas)', true)}
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {mapped.length} linhas com e-mail ou CPF serão enviadas.
              </p>
              <Button onClick={submit} disabled={loading || mapped.length === 0} className="gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Atualizar CPFs
              </Button>
            </div>
          </>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat label="CPF gravado" value={result.saved} />
              <Stat label="Conta criada + CPF" value={result.created} />
              <Stat label="Já tinham este CPF" value={result.unchanged} />
              <Stat label="Conta com outro CPF" value={result.different} />
              <Stat label="Linhas puladas" value={result.skipped} />
              <Stat label="Falharam" value={result.failed} />
            </div>

            {notSaved.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-sm font-medium mb-2">Não gravados ({notSaved.length})</p>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>E-mail</TableHead>
                      <TableHead>CPF na planilha</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notSaved.map((item, index) => (
                      <TableRow key={`${item.email}-${index}`}>
                        <TableCell className="text-sm">{item.email || '—'}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{item.cpf || '—'}</TableCell>
                        <TableCell className="text-sm">{CPF_STATUS_LABELS[item.status]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setHeaders([]);
                setRows([]);
                setFileName('');
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              Enviar outra planilha
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/50 p-3">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
