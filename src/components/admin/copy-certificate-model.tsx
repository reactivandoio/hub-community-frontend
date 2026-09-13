'use client';

import { useMutation, useQuery } from '@apollo/client';
import { Copy, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { CertificateEventInfo } from '@/lib/certificate';
import { CERTIFICATE_CONFIGS, COPY_CERTIFICATE_CONFIG } from '@/lib/queries';
import type {
  CertificateConfig,
  CertificateConfigsResponse,
  CopyCertificateConfigResponse,
} from '@/lib/types';

// react-pdf + pdf.js: browser only.
const CertificatePreview = dynamic(() => import('@/components/certificate/certificate-preview'), {
  ssr: false,
  loading: () => <div className="h-40 rounded-lg border bg-muted/30 animate-pulse" />,
});

interface CopyCertificateModelProps {
  eventId: string;
  /** The event receiving the copy — the preview renders the chosen model with its data. */
  event: CertificateEventInfo;
  onCopied: (config: CertificateConfig) => void;
}

const eventLabel = (title: string, startDate?: string | null) => {
  if (!startDate) return title;
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return title;
  return `${title} — ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
};

/**
 * "Copiar modelo de outro evento": pick among the events that already have a model,
 * see it rendered for THIS event, then copy it over (the form then shows it for review).
 */
export function CopyCertificateModel({ eventId, event, onCopied }: CopyCertificateModelProps) {
  const { toast } = useToast();
  const [sourceId, setSourceId] = useState('');
  const { data, loading, error } = useQuery<CertificateConfigsResponse>(CERTIFICATE_CONFIGS, {
    fetchPolicy: 'cache-and-network',
  });
  const [copyConfig, { loading: copying }] = useMutation<CopyCertificateConfigResponse>(COPY_CERTIFICATE_CONFIG);

  const sources = useMemo(
    () => (data?.certificateConfigs || []).filter((item) => item.event.id !== eventId),
    [data, eventId],
  );
  const selected = sources.find((item) => item.event.id === sourceId) || null;

  const handleCopy = async () => {
    if (!selected) return;
    try {
      const result = await copyConfig({ variables: { fromEventId: selected.event.id, toEventId: eventId } });
      if (result.data?.copyCertificateConfig) {
        onCopied(result.data.copyCertificateConfig);
        toast({ title: 'Modelo copiado', description: `Copiado de "${selected.event.title}". Revise e salve.` });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível copiar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="copy-source">Copiar modelo de outro evento</Label>
          <Select value={sourceId} onValueChange={setSourceId} disabled={loading && sources.length === 0}>
            <SelectTrigger id="copy-source" aria-label="Copiar modelo de outro evento">
              <SelectValue placeholder={loading ? 'Carregando modelos...' : 'Escolha um evento'} />
            </SelectTrigger>
            <SelectContent>
              {sources.map((item) => (
                <SelectItem key={item.event.id} value={item.event.id}>
                  {eventLabel(item.event.title, item.event.start_date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={handleCopy} disabled={copying || !selected}>
          {copying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
          Copiar
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">Não foi possível carregar os modelos: {error.message}</p>}
      {!loading && !error && sources.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum outro evento tem modelo de certificado ainda.</p>
      )}

      {selected && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Prévia do modelo de &ldquo;{selected.event.title}&rdquo; com os dados deste evento.
          </p>
          <CertificatePreview
            config={selected.config}
            event={event}
            certificate={{ code: 'RCT-EXEMPLO1', name: 'Nome do Participante' }}
          />
        </div>
      )}
    </div>
  );
}
