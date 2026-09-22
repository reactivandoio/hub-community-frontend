'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { read, utils, write } from 'xlsx';
import confetti from 'canvas-confetti';
import { 
  FileUp, 
  Settings, 
  Users, 
  RefreshCw, 
  ChevronRight,
  User,
  PartyPopper,
  Search,
  Trophy,
  Download,
  Info,
  ShieldCheck,
  ShieldAlert,
  List,
  Share2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLazyQuery } from '@apollo/client';
import { EVENT_SIGNUPS } from '@/lib/queries';
import { RAFFLE_EVENT_PARAM, raffleNamesFromSignups } from '@/lib/raffle';

// --- Clock Component ---
const Clock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right font-mono pointer-events-none hidden md:block">
      <div className="text-muted-foreground text-xs uppercase tracking-widest mb-1">
        {time.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).replace('-feira', '')}
      </div>
      <div className="text-2xl font-bold text-foreground">
        {time.toLocaleTimeString('pt-BR')}
      </div>
    </div>
  );
};

// --- Main Page ---
export default function SorteioPage() {
  const [step, setStep] = useState<'upload' | 'draw'>('upload');
  const [rawData, setRawData] = useState<any[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [remainingParticipants, setRemainingParticipants] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [rollingText, setRollingText] = useState('---');
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [winnersHistory, setWinnersHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const [showInfo, setShowInfo] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Opened from /admin/events/[id] with ?event=slug: skip the upload and draw
  // among the people who checked in. Read from window (not useSearchParams) so
  // the page needs no Suspense boundary.
  const [eventLoadMessage, setEventLoadMessage] = useState('');
  const [loadEventSignups] = useLazyQuery(EVENT_SIGNUPS, { fetchPolicy: 'network-only' });

  useEffect(() => {
    const eventSlug = new URLSearchParams(window.location.search).get(RAFFLE_EVENT_PARAM);
    if (!eventSlug) return;

    setEventLoadMessage('Carregando participantes do evento...');
    loadEventSignups({ variables: { eventSlug } })
      .then(({ data, error }) => {
        if (error) throw error;
        const list = raffleNamesFromSignups(data?.eventSignups || []);
        if (list.length === 0) {
          setEventLoadMessage('Ninguém fez check-in neste evento ainda. Importe uma planilha para sortear.');
          return;
        }
        setEventLoadMessage('');
        setParticipants(list);
        setRemainingParticipants(list);
        setStep('draw');
      })
      .catch(() => {
        setEventLoadMessage('Não foi possível carregar os participantes do evento. Importe uma planilha para sortear.');
      });
  }, [loadEventSignups]);

  // Handle CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws);

      if (data.length > 0) {
        // Filtra linhas vazias ou incoerentes (exige pelo menos 2 colunas preenchidas)
        const filteredData = data.filter((row: any) => {
          const values = Object.values(row).filter(val => 
            val !== null && val !== undefined && String(val).trim() !== ""
          );
          // Retorna true apenas se houver pelo menos 2 valores coerentes na linha
          return values.length >= 2;
        });

        if (filteredData.length === 0) {
          alert("O arquivo parece estar vazio ou não contém dados válidos.");
          return;
        }

        setRawData(filteredData);
        const cols = Object.keys(filteredData[0] as object);
        setColumns(cols);
        // Tenta pre-selecionar colunas comuns
        const commonCols = ['nome', 'name', 'email', 'telefone', 'phone', 'contato'];
        const found = cols.find(c => commonCols.includes(c.toLowerCase()));
        if (found) setSelectedColumn(found);
      }
    };
    reader.readAsBinaryString(file);
  };

  const initDraw = () => {
    if (!selectedColumn) return;
    const list = rawData.map(row => String(row[selectedColumn])).filter(val => val && val.trim() !== "");
    if (list.length === 0) {
      alert("Nenhum dado válido encontrado na coluna selecionada.");
      return;
    }
    setParticipants(list);
    setRemainingParticipants(list);
    setStep('draw');
  };

  // --- Aleatoriedade Criptográfica ---
  const getSecureRandom = (max: number) => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  };

  const shuffleArray = (array: string[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = getSecureRandom(i + 1);
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const startRoll = () => {
    if (remainingParticipants.length === 0) {
        alert("Todos os participantes já foram sorteados!");
        return;
    }

    setIsRolling(true);
    setWinner(null);
    setRollingText('---');
    
    // Embaralha a lista antes de começar a animação
    const shuffled = shuffleArray(remainingParticipants);

    let counter = 0;
    const duration = 3000;
    const intervalTime = 50;

    const interval = setInterval(() => {
        const randomIndex = getSecureRandom(shuffled.length);
        const randomValue = shuffled[randomIndex];
        // Mostra apenas a primeira parte (primeiro nome) durante a animação
        const firstPart = String(randomValue).split(' ')[0];
        setRollingText(firstPart);
        counter += intervalTime;

        if (counter >= duration) {
            clearInterval(interval);
            finishDraw(shuffled);
        }
    }, intervalTime);
  };

  const finishDraw = (currentList?: string[]) => {
    const listToWrap = currentList || remainingParticipants;
    const finalIndex = getSecureRandom(listToWrap.length);
    const selectedWinner = listToWrap[finalIndex];
    
    // Update remaining list (usa a lista original para remover corretamente)
    const originalIndex = remainingParticipants.indexOf(selectedWinner);
    const newList = [...remainingParticipants];
    if (originalIndex > -1) newList.splice(originalIndex, 1);
    
    setWinner(selectedWinner);
    setRollingText(selectedWinner);
    setRemainingParticipants(newList);
    
    // Atualiza histórico e persiste no localStorage para a página de galeria
    const updatedHistory = [selectedWinner, ...winnersHistory];
    setWinnersHistory(updatedHistory);
    localStorage.setItem('draw_winners_history', JSON.stringify(updatedHistory));
    
    setIsRolling(false);

    // Confetti
    triggerConfetti();
  };

  const downloadCleanedData = () => {
    if (rawData.length === 0) return;
    
    const ws = utils.json_to_sheet(rawData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Participantes_Tratados");
    
    const wbout = write(wb, { bookType: 'csv', type: 'binary' });
    const s2ab = (s: string) => {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i=0; i<s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
      return buf;
    };

    const blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "participantes_tratados.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const triggerConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const reset = () => {
    setStep('upload');
    setWinner(null);
    setRollingText('---');
    setRawData([]);
    setColumns([]);
    setSelectedColumn('');
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Visual background details */}
      <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-40">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 blur-[100px] rounded-full animate-pulse delay-700" />
      </div>

      <div className="w-full max-w-4xl relative z-10">
        {/* Header with Title and Clock */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 px-2">
           <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                 <PartyPopper className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Sorteio de Comunidade</h1>
           </div>
           <Clock />
        </div>

        <AnimatePresence mode="wait">
          {step === 'upload' ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-border/40 shadow-xl overflow-hidden glass">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-3xl font-bold">Importar Participantes</CardTitle>
                  <CardDescription>
                    Selecione um arquivo CSV ou Excel para começar o sorteio
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-6 md:p-10">
                  {eventLoadMessage && (
                    <p className="text-center text-sm text-muted-foreground">{eventLoadMessage}</p>
                  )}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group cursor-pointer border-2 border-dashed border-muted rounded-2xl p-12 text-center transition-all hover:border-primary/50 hover:bg-accent/50"
                  >
                    <input 
                      type="file" 
                      id="csv-file" 
                      ref={fileInputRef}
                      accept=".csv,.xlsx,.xls" 
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <FileUp className="w-16 h-16 text-muted-foreground mx-auto mb-4 group-hover:text-primary transition-all group-hover:-translate-y-1" />
                    <p className="text-foreground font-semibold text-lg">
                      {rawData.length > 0 ? `${rawData.length} itens detectados` : 'Arraste ou clique para enviar'}
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">Suporta CSV, XLSX e XLS</p>
                  </div>

                  {columns.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 pt-4"
                    >
                      <Label className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Qual campo devemos usar?
                      </Label>
                      <Select onValueChange={setSelectedColumn} value={selectedColumn}>
                        <SelectTrigger className="h-14 bg-background border-border rounded-xl">
                          <SelectValue placeholder="Selecione uma coluna..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map(col => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      size="lg"
                      disabled={!selectedColumn}
                      onClick={initDraw}
                      className="flex-1 h-16 text-lg font-bold shadow-lg shadow-primary/20"
                    >
                      Configurar Sorteio
                      <ChevronRight className="ml-2 w-5 h-5" />
                    </Button>

                    {rawData.length > 0 && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={downloadCleanedData}
                        className="h-16 px-6 border-primary/20 hover:bg-primary/5"
                        title="Baixar arquivo tratado (sem linhas vazias)"
                      >
                        <Download className="w-6 h-6" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="draw"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="space-y-8"
            >
              {/* Participant Counter */}
              <div className="flex justify-center gap-4">
                 <div className="px-4 py-2 bg-secondary/50 rounded-full border border-border flex items-center gap-2 text-sm font-medium">
                    <Users className="w-4 h-4 text-primary" />
                    <span>{remainingParticipants.length} participantes restantes</span>
                 </div>
              </div>

              {/* Main Raffle Box */}
              <div className="relative group">
                 {/* Winner Indicator */}
                 <AnimatePresence>
                    {winner && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.5 }}
                            animate={{ opacity: 1, y: -40, scale: 1 }}
                            className="absolute -top-12 left-1/2 -translate-x-1/2 z-20"
                        >
                            <div className="bg-primary px-6 py-2 rounded-full shadow-2xl flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-white" />
                                <span className="text-white font-bold tracking-wide">GANHADOR!</span>
                            </div>
                        </motion.div>
                    )}
                 </AnimatePresence>

                 <div className={`
                    relative p-12 md:p-24 bg-card border-2 rounded-[40px] shadow-2xl text-center transition-all duration-500
                    ${isRolling ? 'border-primary shadow-primary/20 scale-[1.02]' : 'border-border'}
                    ${winner ? 'border-primary bg-primary/5 shadow-primary/10' : ''}
                 `}>
                    <div className={`
                        text-5xl md:text-8xl font-black tracking-tight break-words transition-all
                        ${isRolling ? 'blur-[1px] opacity-70 scale-95' : 'opacity-100'}
                        ${winner ? 'text-primary' : 'text-foreground'}
                    `}>
                        {rollingText}
                    </div>
                 </div>

                 {/* Decorative corners */}
                 <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary/20 rounded-tl-[40px] pointer-events-none" />
                 <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary/20 rounded-br-[40px] pointer-events-none" />
              </div>

              <div className="flex flex-col items-center gap-6">
                <Button 
                    size="lg"
                    disabled={isRolling}
                    onClick={startRoll}
                    className="w-full max-w-md h-24 text-2xl font-black uppercase tracking-widest rounded-3xl shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                    {isRolling ? (
                        <span className="flex items-center gap-3">
                            <RefreshCw className="w-6 h-6 animate-spin" />
                            Sorteando...
                        </span>
                    ) : 'Realizar Sorteio'}
                </Button>
                
                <div className="flex gap-4">
                  <Button 
                      variant="ghost"
                      onClick={reset}
                      className="text-muted-foreground hover:text-foreground hover:bg-transparent"
                  >
                      <Settings className="w-4 h-4 mr-2" />
                      Novo Arquivo
                  </Button>

                  <Button 
                      variant="ghost"
                      onClick={() => setShowInfo(!showInfo)}
                      className="text-muted-foreground hover:text-foreground hover:bg-transparent"
                  >
                      <Info className="w-4 h-4 mr-2" />
                      Como funciona?
                  </Button>

                  {winnersHistory.length > 0 && (
                    <div className="flex gap-2">
                       <Button 
                           variant="ghost"
                           onClick={() => setShowHistory(true)}
                           className="text-primary hover:text-primary hover:bg-primary/5"
                       >
                           <List className="w-4 h-4 mr-2" />
                           Ver Ganhadores ({winnersHistory.length})
                       </Button>
                       <Link href="/vencedores">
                          <Button 
                              variant="ghost"
                              className="text-primary hover:text-primary hover:bg-primary/5"
                          >
                              <Share2 className="w-4 h-4 mr-2" />
                              Abrir Galeria
                          </Button>
                       </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal de Histórico de Ganhadores */}
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    onClick={() => setShowHistory(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 20 }}
                      className="w-full max-w-lg"
                      onClick={e => e.stopPropagation()}
                    >
                      <Card className="shadow-2xl border-primary/20 bg-card overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
                          <div>
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                              <Trophy className="w-6 h-6 text-primary" />
                              Lista de Ganhadores
                            </CardTitle>
                            <CardDescription>Participantes já sorteados nesta sessão</CardDescription>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                            <ChevronRight className="w-6 h-6 rotate-90" />
                          </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                            {winnersHistory.map((item, idx) => (
                              <motion.div
                                key={`${item}-${idx}`}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className="flex items-center justify-between p-4 rounded-xl bg-accent/30 border border-border/50 group hover:border-primary/30 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                    #{winnersHistory.length - idx}
                                  </div>
                                  <span className="font-semibold text-foreground">{item}</span>
                                </div>
                                <Trophy className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                              </motion.div>
                            ))}
                          </div>
                        </CardContent>
                        <div className="p-4 bg-accent/20 border-t border-border/50 text-center">
                           <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                              Hub Community - Sorteio Seguro
                           </p>
                        </div>
                      </Card>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Seção Explicativa */}
              <AnimatePresence>
                {showInfo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <Card className="bg-card/50 border-primary/20 mt-4 overflow-hidden">
                      <CardContent className="p-6 space-y-4">
                         <div className="flex items-center gap-2 text-primary">
                            <ShieldCheck className="w-5 h-5" />
                            <h3 className="font-bold">Aleatoriedade de Nível Militar</h3>
                         </div>
                         <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground">
                            <div>
                               <p className="font-semibold text-foreground mb-1">Web Crypto API</p>
                               <p>Utilizamos entropia de hardware do sistema para gerar números criptograficamente seguros, impossíveis de prever ou manipular.</p>
                            </div>
                            <div>
                               <p className="font-semibold text-foreground mb-1">Fisher-Yates Shuffle</p>
                               <p>A lista é embaralhada integralmente através de algoritmos matemáticos avançados antes de cada sorteio.</p>
                            </div>
                         </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Winner Animation Overlay */}
              <AnimatePresence>
                {winner && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
                    >
                         <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.2, 1] }}
                            transition={{ duration: 0.5 }}
                            className="bg-primary/10 w-[600px] h-[600px] rounded-full blur-[120px]" 
                         />
                    </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .glass {
          background: rgba(var(--background-rgb), 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}
