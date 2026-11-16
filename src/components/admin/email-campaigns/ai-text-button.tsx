'use client';

import { useMutation, useQuery } from '@apollo/client';
import { Loader2, Settings, Sparkles, Square } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  aiSettingsHref,
  draftOf,
  GENERATION_POLL_MS,
  GENERATION_STATUS_LABELS,
  isGenerationActive,
  MAX_AI_INSTRUCTIONS,
  needsSetup,
  newRequestId,
  previewTail,
  readError,
} from '@/lib/ai-text';
import {
  CANCEL_AI_TEXT_GENERATION,
  GENERATE_EMAIL_CAMPAIGN_TEXT,
  GET_AI_TEXT_GENERATION,
  GET_TERMHUB_SETTINGS,
} from '@/lib/queries';
import type { AiTextGeneration, EmailCampaignType, TermhubSettings } from '@/lib/types';

export interface AiDraft {
  subject: string;
  message: string;
}

interface AiTextButtonProps {
  eventSlug: string;
  type: EmailCampaignType;
  /** What is in the form now: the AI may improve it. */
  current: { subject: string; message: string };
  /** Puts the reviewed draft in the form. Nothing is sent from here. */
  onApply: (draft: AiDraft) => void;
}

/**
 * REA-51: "Gerar texto com IA" of one campaign. Without a saved termhub token it goes to the AI
 * settings (and back). Otherwise it starts a run in the BFF, shows how it goes (queue, the text
 * being written) with a cancel button, and offers the draft to put in the form. The AI never sends.
 */
export function AiTextButton({ eventSlug, type, current, onApply }: AiTextButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string | null; message: string } | null>(null);
  const requestId = useRef<string | null>(null);
  // The answer of a cancel is final for that generation.
  const [cancelled, setCancelled] = useState<AiTextGeneration | null>(null);

  const settings = useQuery<{ termhubSettings: TermhubSettings }>(GET_TERMHUB_SETTINGS, { fetchPolicy: 'cache-first' });
  const configured = settings.data?.termhubSettings.configured;
  const settingsHref = aiSettingsHref(pathname);

  const [generate, generating] = useMutation<{ generateEmailCampaignText: AiTextGeneration }>(GENERATE_EMAIL_CAMPAIGN_TEXT);
  const [cancel, cancelling] = useMutation<{ cancelAiTextGeneration: AiTextGeneration }>(CANCEL_AI_TEXT_GENERATION);
  const poll = useQuery<{ aiTextGeneration: AiTextGeneration }>(GET_AI_TEXT_GENERATION, {
    variables: { id: generationId },
    skip: !generationId,
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: false,
  });

  // A cancel answer is final; otherwise the last poll, else the mutation's first answer.
  const pick = (g: AiTextGeneration | null | undefined) => (g && g.id === generationId ? g : null);
  const generation = generationId
    ? (pick(cancelled)
      ?? pick(poll.data?.aiTextGeneration)
      ?? pick(generating.data?.generateEmailCampaignText))
    : null;
  const active = isGenerationActive(generation?.status);

  const { startPolling, stopPolling } = poll;
  useEffect(() => {
    if (generationId && active) startPolling(GENERATION_POLL_MS);
    else stopPolling();
    return () => stopPolling();
  }, [generationId, active, startPolling, stopPolling]);

  const onClick = () => {
    if (settings.data && !configured) {
      router.push(settingsHref);
      return;
    }
    setOpen(true);
  };

  const onGenerate = async () => {
    setError(null);
    setGenerationId(null);
    requestId.current = newRequestId();
    try {
      const result = await generate({
        variables: {
          input: {
            eventSlug,
            type,
            subject: current.subject.trim() || null,
            message: current.message.trim() || null,
            instructions: instructions.trim() || null,
            requestId: requestId.current,
          },
        },
      });
      const id = result.data?.generateEmailCampaignText.id;
      if (id) setGenerationId(id);
    } catch (err) {
      setError(readError(err));
    }
  };

  const onCancel = async () => {
    if (!generationId) return;
    try {
      const result = await cancel({ variables: { id: generationId } });
      setCancelled(result.data?.cancelAiTextGeneration ?? null);
    } catch (err) {
      setError(readError(err));
    }
  };

  const draft = draftOf(generation);
  const onUse = () => {
    if (!draft) return;
    onApply(draft);
    setOpen(false);
    setGenerationId(null);
  };

  const onOpenChange = (next: boolean) => {
    // While the run goes, closing must be a choice: cancel it first.
    if (!next && (active || generating.loading)) return;
    setOpen(next);
    if (!next) {
      setGenerationId(null);
      setError(null);
    }
  };

  const failure = error ?? (generation?.status === 'failed'
    ? { code: generation.error_code, message: generation.error_message || 'A geração falhou.' }
    : null);
  const busy = generating.loading || active;
  const preview = previewTail(generation?.preview);

  return (
    <>
      <Button variant="outline" size="sm" onClick={onClick} disabled={settings.loading && !settings.data}>
        <Sparkles className="mr-2 h-4 w-4" />
        {settings.data && !configured ? 'Gerar texto com IA (configurar)' : 'Gerar texto com IA'}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar texto com IA</DialogTitle>
            <DialogDescription>
              A IA escreve um rascunho de assunto e mensagem com os dados do evento. Você revisa e edita antes de enviar;
              nada é enviado daqui.
            </DialogDescription>
          </DialogHeader>

          {!generation && (
            <div className="space-y-2">
              <Label htmlFor={`ai-instructions-${type}`}>Pedido para a IA (opcional)</Label>
              <Textarea
                id={`ai-instructions-${type}`}
                value={instructions}
                maxLength={MAX_AI_INSTRUCTIONS}
                rows={3}
                disabled={busy}
                placeholder="Ex.: tom descontraído, destaque o networking e a pizza no intervalo."
                onChange={(e) => setInstructions(e.target.value)}
              />
              {(current.subject.trim() || current.message.trim()) && (
                <p className="text-xs text-muted-foreground">O texto que já está no formulário vai junto, para a IA melhorar.</p>
              )}
            </div>
          )}

          {generation && (
            <div className="space-y-3" aria-live="polite">
              <p role="status" className="flex items-center gap-2 text-sm font-medium">
                {active && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {GENERATION_STATUS_LABELS[generation.status]}
              </p>
              {active && preview && (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {preview}
                </pre>
              )}
              {draft && (
                <div className="space-y-3 rounded-md border p-4">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Assunto</p>
                    <p className="font-medium">{draft.subject}</p>
                  </div>
                  {draft.message && (
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">Mensagem</p>
                      <p className="whitespace-pre-line text-sm">{draft.message}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {failure && (
            <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{failure.message}</p>
              {needsSetup(failure.code) && (
                <Button asChild variant="outline" size="sm">
                  <Link href={settingsHref}>
                    <Settings className="mr-2 h-4 w-4" /> Abrir configuração de IA
                  </Link>
                </Button>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {busy ? (
              <Button variant="outline" onClick={onCancel} disabled={!generationId || cancelling.loading}>
                <Square className="mr-2 h-4 w-4" /> {cancelling.loading ? 'Cancelando…' : 'Cancelar geração'}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            )}
            {draft && !busy && (
              <Button variant="outline" onClick={() => setGenerationId(null)}>Gerar outro</Button>
            )}
            {draft && !busy ? (
              <Button onClick={onUse}>Usar este texto</Button>
            ) : (
              !generation || !active ? (
                <Button onClick={onGenerate} disabled={busy}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {generating.loading ? 'Começando…' : failure || generation ? 'Tentar de novo' : 'Gerar'}
                </Button>
              ) : null
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
