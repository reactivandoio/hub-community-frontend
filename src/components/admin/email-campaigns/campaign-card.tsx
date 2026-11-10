'use client';

import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { Eye, Send, TestTube2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { audienceSummary, defaultSubject, type CampaignKind } from '@/lib/email-campaign';
import {
  GET_EMAIL_CAMPAIGN_AUDIENCE,
  GET_EMAIL_CAMPAIGN_PREVIEW,
  GET_EVENT_EMAIL_CAMPAIGNS,
  SEND_EMAIL_CAMPAIGN_TEST,
  START_EMAIL_CAMPAIGN,
} from '@/lib/queries';
import type { EmailCampaignAudience } from '@/lib/types';

const MAX_SUBJECT = 150;
const MAX_MESSAGE = 2000;

interface CampaignCardProps {
  eventSlug: string;
  eventTitle?: string | null;
  kind: CampaignKind;
  /** A campaign of this type is sending or paused: a new one waits for it. */
  running: boolean;
}

/** One of the three e-mails: audience, subject and message, preview, test and send (REA-29). */
export function CampaignCard({ eventSlug, eventTitle, kind, running }: CampaignCardProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, loading } = useQuery<{ emailCampaignAudience: EmailCampaignAudience }>(GET_EMAIL_CAMPAIGN_AUDIENCE, {
    variables: { eventSlug, type: kind.type },
    fetchPolicy: 'cache-and-network',
  });
  const audience = data?.emailCampaignAudience;
  const input = { eventSlug, type: kind.type, subject: subject.trim() || null, message: message.trim() || null };

  const [loadPreview, preview] = useLazyQuery<{ emailCampaignPreview: { subject: string; html: string } }>(
    GET_EMAIL_CAMPAIGN_PREVIEW,
    { fetchPolicy: 'network-only' },
  );
  const [sendTest, test] = useMutation(SEND_EMAIL_CAMPAIGN_TEST);
  const [start, starting] = useMutation(START_EMAIL_CAMPAIGN, {
    refetchQueries: [{ query: GET_EVENT_EMAIL_CAMPAIGNS, variables: { eventSlug } }],
  });

  const openPreview = () => {
    setPreviewOpen(true);
    loadPreview({ variables: { input } });
  };

  const onTest = async () => {
    try {
      await sendTest({ variables: { input } });
      toast.success('Enviamos o teste para o seu e-mail.');
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível enviar o teste.');
    }
  };

  const onStart = async () => {
    try {
      await start({ variables: { input } });
      toast.success('Campanha na fila. O envio começa no próximo minuto.');
      setSubject('');
      setMessage('');
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível iniciar a campanha.');
    } finally {
      setConfirmOpen(false);
    }
  };

  const canSend = Boolean(audience?.sending_enabled && audience.total > 0 && !running);

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{kind.title}</h2>
          <Badge variant="secondary">{kind.audience}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{kind.description}</p>
        {loading && !audience ? (
          <Skeleton className="h-4 w-48" />
        ) : audience ? (
          <p className="text-sm font-medium">{audienceSummary(audience)}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`subject-${kind.type}`}>Assunto</Label>
        <Input
          id={`subject-${kind.type}`}
          value={subject}
          maxLength={MAX_SUBJECT}
          placeholder={defaultSubject(kind.type, eventTitle)}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`message-${kind.type}`}>Mensagem (opcional)</Label>
        <Textarea
          id={`message-${kind.type}`}
          value={message}
          maxLength={MAX_MESSAGE}
          rows={3}
          placeholder="Um recado seu, acima do botão. Os dados do evento já vão no e-mail."
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {running && <p className="text-sm text-muted-foreground">Já existe um envio deste tipo em andamento (veja abaixo).</p>}
      {audience && !audience.sending_enabled && (
        <p className="text-sm text-muted-foreground">O envio de campanhas está desligado neste servidor. Prévia e teste funcionam.</p>
      )}
      {audience?.redirect_to && (
        <p className="text-sm text-amber-600 dark:text-amber-400">Servidor de teste: os e-mails vão para {audience.redirect_to}.</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={openPreview}>
          <Eye className="mr-2 h-4 w-4" /> Prévia
        </Button>
        <Button variant="outline" size="sm" onClick={onTest} disabled={test.loading}>
          <TestTube2 className="mr-2 h-4 w-4" /> {test.loading ? 'Enviando…' : 'Enviar teste para mim'}
        </Button>
        <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!canSend}>
          <Send className="mr-2 h-4 w-4" /> Enviar
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview.data?.emailCampaignPreview.subject || kind.title}</DialogTitle>
            <DialogDescription>Como o e-mail chega, com o seu nome no lugar do destinatário.</DialogDescription>
          </DialogHeader>
          {preview.loading || !preview.data ? (
            preview.error ? (
              <p className="text-sm text-destructive">{preview.error.message}</p>
            ) : (
              <Skeleton className="h-[60vh] w-full" />
            )
          ) : (
            <iframe
              title={`Prévia: ${kind.title}`}
              srcDoc={preview.data.emailCampaignPreview.html}
              sandbox=""
              className="h-[60vh] w-full rounded-md border bg-white"
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar “{kind.title}”?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {audience && <p>{audienceSummary(audience)}.</p>}
                <p>
                  O envio respeita o limite diário e continua sozinho nos dias seguintes. Quem se descadastrou não
                  recebe. Dá para pausar ou cancelar no histórico.
                </p>
                {audience?.redirect_to && (
                  <p className="font-medium">Servidor de teste: todos os e-mails vão para {audience.redirect_to}.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); onStart(); }} disabled={starting.loading}>
              {starting.loading ? 'Iniciando…' : 'Enviar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
