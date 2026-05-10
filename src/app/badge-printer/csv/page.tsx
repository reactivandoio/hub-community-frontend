'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  BarChart3,
  Check,
  Download,
  FileJson,
  FileText,
  History as HistoryIcon,
  Link as LinkIcon,
  Plus,
  Printer,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as XLSX from 'xlsx';
import * as z from 'zod';

import { FadeIn } from '@/components/animations';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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

const formSchema = z.object({
  link: z.string().url({
    message: 'Insira um link válido.',
  }),
  eventName: z.string().min(1, {
    message: 'Insira o nome do evento ou comunidade.',
  }),
  nameColumn: z.string().min(1, {
    message: 'Selecione a coluna que contém o nome.',
  }),
});

interface CSVRow {
  [key: string]: any;
  __printed?: boolean;
  __manual?: boolean;
}

interface HistoryItem {
  id: string;
  fileName: string;
  timestamp: number;
  data: CSVRow[];
  headers: string[];
  nameColumn: string;
  eventName: string;
  link: string;
}

const STORAGE_KEY = 'badge-printer-history-v1';

export default function CSVBadgePrinterPage() {
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      link: 'https://hubcommunity.io',
      eventName: 'Reactivando',
      nameColumn: '',
    },
  });

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading history:', e);
      }
    }
  }, []);

  // Sync history to localStorage
  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  };

  const addToHistory = (
    name: string,
    data: CSVRow[],
    cols: string[],
    nameCol: string
  ) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      fileName: name,
      timestamp: Date.now(),
      data,
      headers: cols,
      nameColumn: nameCol,
      eventName: form.getValues('eventName'),
      link: form.getValues('link'),
    };
    const updated = [newItem, ...history].slice(0, 10); // Keep last 10
    saveHistory(updated);
  };

  const updateCurrentHistoryItem = (updatedData: CSVRow[]) => {
    const currentItem = history.find(h => h.fileName === fileName);
    if (currentItem) {
      const updatedHistory = history.map(h =>
        h.id === currentItem.id ? { ...h, data: updatedData } : h
      );
      saveHistory(updatedHistory);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setFileName(item.fileName);
    setHeaders(item.headers);
    setCsvData(item.data);
    form.setValue('nameColumn', item.nameColumn);
    form.setValue('eventName', item.eventName);
    form.setValue('link', item.link);
    setSearchTerm('');
  };

  const deleteHistoryItem = (id: string) => {
    saveHistory(history.filter(h => h.id !== id));
  };

  const onFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSearchTerm(''); // Reset search on new upload
    const reader = new FileReader();

    reader.onload = e => {
      const data = e.target?.result;
      let rows: CSVRow[] = [];
      let headerRow: string[] = [];

      try {
        if (file.name.endsWith('.csv')) {
          const text = data as string;
          const workbook = XLSX.read(text, { type: 'string' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
          }) as any[][];

          if (json.length > 0) {
            headerRow = json[0].map(h => String(h || '').trim());
            rows = XLSX.utils.sheet_to_json(worksheet, {
              defval: '',
            }) as CSVRow[];
          }
        } else {
          const arrayBuffer = data as ArrayBuffer;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
          }) as any[][];

          if (json.length > 0) {
            headerRow = json[0].map(h => String(h || '').trim());
            rows = XLSX.utils.sheet_to_json(worksheet, {
              defval: '',
            }) as CSVRow[];
          }
        }

        setHeaders(headerRow);
        setCsvData(rows);

        // Auto-select "Nome" if it exists
        let nameCol = '';
        if (headerRow.includes('Nome')) {
          nameCol = 'Nome';
        } else if (headerRow.includes('Name')) {
          nameCol = 'Name';
        }
        form.setValue('nameColumn', nameCol);

        // Add to history
        addToHistory(file.name, rows, headerRow, nameCol);
      } catch (error) {
        console.error('Error parsing file:', error);
        alert(
          'Erro ao processar o arquivo. Verifique se o formato está correto.'
        );
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handlePrint = async (
    name: string,
    link: string,
    eventName: string,
    rowIndex?: number
  ) => {
    const qrDataUrl =
      document
        .getElementById(`qr-canvas-${name}`)
        ?.querySelector('canvas')
        ?.toDataURL() || '';

    await printBadge({
      fullName: name,
      qrDataUrl,
      logoText: eventName,
      link,
    });

    if (rowIndex !== undefined) {
      setCsvData(prevData => {
        const newData = [...prevData];
        newData[rowIndex] = { ...newData[rowIndex], __printed: true };
        updateCurrentHistoryItem(newData);
        return newData;
      });
    }
  };

  const handleManualPrint = () => {
    if (!manualName) return;

    const nameCol = selectedNameColumn || 'Nome';
    let currentFileName = fileName;
    let currentHeaders = headers;

    // Use a fresh state update to avoid issues with stale state
    setCsvData(prevData => {
      const newRow: CSVRow = {
        [nameCol]: manualName,
        __printed: true,
        __manual: true,
      };
      const newData = [...prevData, newRow];

      if (!currentFileName) {
        currentFileName = 'Lista Manual';
        currentHeaders = [nameCol];
        setFileName(currentFileName);
        setHeaders(currentHeaders);
        form.setValue('nameColumn', nameCol);
        addToHistory(currentFileName, newData, currentHeaders, nameCol);
      } else {
        updateCurrentHistoryItem(newData);
      }

      return newData;
    });

    handlePrint(manualName, staticLink, currentEventName);
    setIsManualModalOpen(false);
    setManualName('');
  };

  const exportList = () => {
    if (csvData.length === 0) return;

    // Prepare data for export: replace __printed with "Sim/Não"
    const exportData = csvData.map(row => {
      const { __printed, ...rest } = row;
      return {
        ...rest,
        'Impresso?': __printed ? 'Sim' : 'Não',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Participantes');

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const exportFileName = `lista_crachas_${fileName.split('.')[0]}_${date}.xlsx`;

    XLSX.writeFile(workbook, exportFileName);
  };

  const viewJsonInNewTab = () => {
    if (csvData.length === 0) return;

    // Remove internal fields for a cleaner JSON export
    const cleanData = csvData.map(row => {
      const { __printed, __manual, ...rest } = row;
      return rest;
    });

    const jsonString = JSON.stringify(cleanData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const newTab = window.open(url, '_blank');
    if (newTab) {
      newTab.focus();
    }
  };

  const selectedNameColumn = form.watch('nameColumn');
  const staticLink = form.watch('link');
  const currentEventName = form.watch('eventName');

  const getFullName = (row: CSVRow, nameCol: string) => {
    if (!nameCol) return '';
    const firstName = String(row[nameCol] || '').trim();
    if (!firstName) return '';

    let surname = '';
    const keys = Object.keys(row);
    const surnameKey = keys.find(k => {
      const lower = k.toLowerCase().trim();
      return (
        lower === 'sobrenome' ||
        lower.includes('sobrenome') ||
        lower === 'last name' ||
        lower === 'surname'
      );
    });

    if (surnameKey && surnameKey !== nameCol) {
      surname = String(row[surnameKey] || '').trim();
    }

    return surname ? `${firstName} ${surname}` : firstName;
  };

  const filteredData = csvData.filter(row => {
    if (!searchTerm) return true;
    const name = getFullName(row, selectedNameColumn);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalCount = csvData.length;
  const printedCount = csvData.filter(row => row.__printed).length;
  const manualCount = csvData.filter(row => row.__manual).length;

  return (
    <main className="container mx-auto py-10 px-4 min-h-screen">
      <FadeIn direction="up" duration={0.3}>
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Impressão em Massa (CSV/XLSX)
              </h1>
              <p className="text-muted-foreground">
                Faça upload de um arquivo CSV ou Excel e mapeie a coluna de
                nomes para imprimir crachás individuais.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog
                open={isManualModalOpen}
                onOpenChange={setIsManualModalOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Impressão Manual
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Impressão Manual de Crachá</DialogTitle>
                    <DialogDescription>
                      Digite o nome do participante para gerar o crachá
                      individualmente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Nome do Participante</Label>
                      <Input
                        placeholder="Nome Completo"
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                      />
                    </div>
                    {/* Hidden QR Code for manual print */}
                    <div id={`qr-canvas-${manualName}`} className="hidden">
                      <QRCodeCanvas value={staticLink} size={128} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setManualName('');
                        setIsManualModalOpen(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button disabled={!manualName} onClick={handleManualPrint}>
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimir
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Arquivo
              </Button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileUpload}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Configurações</CardTitle>
                <CardDescription>
                  Configure o link do QR Code e o nome do evento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="eventName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Evento/Comunidade</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Reactivando" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="link"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link do QR Code (Estático)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="https://exemplo.com"
                                className="pl-9"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nameColumn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coluna de Nome</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a coluna" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {headers.map(header => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Qual coluna do arquivo contém os nomes?
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {fileName && (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                        <FileText className="w-4 h-4" />
                        <span className="truncate">{fileName}</span>
                      </div>
                    )}
                  </div>
                </Form>
              </CardContent>
            </Card>

            {history.length > 0 && (
              <Card className="lg:col-span-1 border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HistoryIcon className="w-4 h-4 text-primary" />
                      <CardTitle className="text-sm">
                        Histórico Recente
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => saveHistory([])}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    Arquivos carregados recentemente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-2">
                    {history.map(item => (
                      <div
                        key={item.id}
                        className={`group flex items-center justify-between p-2 rounded-md border text-sm transition-all cursor-pointer hover:border-primary/50 hover:shadow-sm ${fileName === item.fileName ? 'bg-background border-primary shadow-md' : 'bg-background border-border'}`}
                        onClick={() => loadFromHistory(item)}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText
                            className={`w-4 h-4 flex-shrink-0 ${fileName === item.fileName ? 'text-primary' : 'text-muted-foreground'}`}
                          />
                          <span
                            className={`truncate font-medium ${fileName === item.fileName ? 'text-primary' : 'text-foreground'}`}
                          >
                            {item.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link href={`/badge-printer/history/${item.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={e => e.stopPropagation()}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                            onClick={e => {
                              e.stopPropagation();
                              deleteHistoryItem(item.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Lista de Participantes</CardTitle>
                <CardDescription>
                  Visualize e imprima os crachás individualmente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-muted/50 p-3 rounded-lg border border-border/50 text-center">
                    <div className="text-2xl font-bold">{totalCount}</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Total
                    </div>
                  </div>
                  <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20 text-center">
                    <div className="text-2xl font-bold text-green-700">
                      {printedCount}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-green-600 tracking-wider">
                      Impressos
                    </div>
                  </div>
                  <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 text-center">
                    <div className="text-2xl font-bold text-blue-700">
                      {manualCount}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                      Manuais
                    </div>
                  </div>
                </div>

                {csvData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1 flex gap-2">
                        <Input
                          placeholder="Pesquisar por nome..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="flex-1"
                        />
                        {searchTerm && (
                          <Button
                            variant="ghost"
                            onClick={() => setSearchTerm('')}
                            className="text-muted-foreground"
                          >
                            Resetar
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={viewJsonInNewTab}
                        className="whitespace-nowrap"
                      >
                        <FileJson className="w-4 h-4 mr-2" />
                        Ver JSON
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportList}
                        className="whitespace-nowrap"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar Lista Atualizada
                      </Button>
                    </div>

                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="w-[100px] text-right">
                              Ações
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredData.map((row, index) => {
                            const name = getFullName(row, selectedNameColumn);
                            const isPrinted = !!row.__printed;

                            return (
                              <TableRow
                                key={index}
                                className={
                                  isPrinted
                                    ? 'bg-muted/50 text-muted-foreground transition-colors'
                                    : ''
                                }
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {isPrinted && (
                                      <Check className="w-3 h-3 text-green-600" />
                                    )}
                                    {name || (
                                      <span className="text-muted-foreground italic">
                                        Vazio
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end items-center gap-2">
                                    <div
                                      id={`qr-canvas-${name}`}
                                      className="hidden"
                                    >
                                      <QRCodeCanvas
                                        value={staticLink}
                                        size={128}
                                      />
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!name || !selectedNameColumn}
                                      onClick={() =>
                                        handlePrint(
                                          name,
                                          staticLink,
                                          currentEventName,
                                          csvData.indexOf(row) // Use index from original data for correct tracking
                                        )
                                      }
                                    >
                                      <Printer
                                        className={`${isPrinted ? 'text-green-600' : ''} w-4 h-4`}
                                      />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {filteredData.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={2}
                                className="h-24 text-center"
                              >
                                Nenhum participante encontrado.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                    <Upload className="w-8 h-8 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Faça upload de um arquivo CSV ou Excel para começar.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </FadeIn>
    </main>
  );
}
