'use client';

import { useMutation, useQuery } from '@apollo/client';
import { AlertTriangle, CheckCircle2, ExternalLink, KeyRound } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  OPAPINGOU_KEYS_URL,
  OPAPINGOU_SIGNUP_URL,
  REQUIRED_SCOPES,
  connectionLabel,
  looksLikeOpaPingouKey,
  opaPingouErrorMessage,
} from '@/lib/opapingou-account';
import {
  CONNECT_EVENT_OPAPINGOU,
  DISCONNECT_EVENT_OPAPINGOU,
  EVENT_OPAPINGOU_ACCOUNT,
  USE_OPAPINGOU_CONNECTION,
} from '@/lib/queries';
import type { EventOpaPingouAccount } from '@/lib/types';

interface OpaPingouAccountCardProps {
  /** Hub event id; undefined while the event is being created. */
  eventId?: string;
}

type AccountData = { eventOpaPingouAccount: EventOpaPingouAccount };

const externalLink = 'text-primary underline underline-offset-2';

/**
 * REA-12: which Opa Pingou account charges the paid lots of the event. The key is typed here,
 * sent once to the BFF and cleared; the card only ever shows the company and the key's end.
 * Lives inside the event <form>: no nested form, buttons are type="button" and Enter in the key
 * field connects instead of saving the event.
 */
export function OpaPingouAccountCard({ eventId }: OpaPingouAccountCardProps) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { data, loading, error: loadError } = useQuery<AccountData>(EVENT_OPAPINGOU_ACCOUNT, {
    variables: { eventId },
    skip: !eventId,
    fetchPolicy: 'network-only',
  });

  // Every mutation answers the whole account: write it where the query reads it.
  const writeAccount = (account: EventOpaPingouAccount | undefined) => (cache: any) => {
    if (!account) return;
    cache.writeQuery({
      query: EVENT_OPAPINGOU_ACCOUNT,
      variables: { eventId },
      data: { eventOpaPingouAccount: account },
    });
  };

  const [connect, { loading: connecting }] = useMutation(CONNECT_EVENT_OPAPINGOU);
  const [reuse, { loading: reusing }] = useMutation(USE_OPAPINGOU_CONNECTION);
  const [disconnect, { loading: disconnecting }] = useMutation(DISCONNECT_EVENT_OPAPINGOU);
  const busy = connecting || reusing || disconnecting;

  const account = data?.eventOpaPingouAccount;
  const connection = account?.connection || null;
  const showForm = !connection || replacing;
  const reusable = (account?.reusable || []).filter((c) => c.id !== connection?.id);

  const done = (message: string) => {
    setApiKey('');
    setReplacing(false);
    setError(null);
    toast({ title: message });
  };

  const handleConnect = async () => {
    setError(null);
    const value = apiKey.trim();
    if (!looksLikeOpaPingouKey(value)) {
      setError('Cole a chave inteira do Opa Pingou: ela começa com opk_live_.');
      return;
    }
    try {
      await connect({
        variables: { eventId, apiKey: value },
        update: (cache, result) => writeAccount(result.data?.connectEventOpaPingou)(cache),
      });
      done('Conta Opa Pingou conectada');
    } catch (err) {
      setError(opaPingouErrorMessage(err));
    }
  };

  const handleReuse = async (connectionId: string) => {
    setError(null);
    try {
      await reuse({
        variables: { eventId, connectionId },
        update: (cache, result) => writeAccount(result.data?.useOpaPingouConnection)(cache),
      });
      done('Conta Opa Pingou conectada');
    } catch (err) {
      setError(opaPingouErrorMessage(err));
    }
  };

  const handleRemove = async () => {
    setConfirmRemove(false);
    setError(null);
    try {
      await disconnect({
        variables: { eventId },
        update: (cache, result) => writeAccount(result.data?.disconnectEventOpaPingou)(cache),
      });
      done('Conta Opa Pingou removida do evento');
    } catch (err) {
      setError(opaPingouErrorMessage(err));
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!busy) void handleConnect();
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="space-y-1">
        <p className="text-base font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Conta Opa Pingou do evento
        </p>
        <p className="text-sm text-muted-foreground">
          O Opa Pingou é o parceiro oficial de pagamentos do Hub Community. Para vender ingressos,
          conecte a conta Opa Pingou da sua comunidade: o dinheiro dos lotes pagos cai direto na
          conta de vocês, por Pix ou link de pagamento. Lotes com valor zero continuam gratuitos;
          nos pagos, a inscrição só é confirmada depois que o pagamento é aprovado.
        </p>
        <p className="text-sm text-muted-foreground">
          Ainda não tem conta?{' '}
          <a href={OPAPINGOU_SIGNUP_URL} target="_blank" rel="noopener noreferrer" className={externalLink}>
            Crie a sua no Opa Pingou
          </a>{' '}
          em poucos minutos.
        </p>
      </div>

      {!eventId ? (
        <p className="text-sm">Salve o evento para conectar a conta Opa Pingou da comunidade.</p>
      ) : loadError ? (
        <p role="alert" className="text-sm text-red-500">
          Não foi possível carregar a conta Opa Pingou: {loadError.message}
        </p>
      ) : loading && !data ? (
        <div className="h-10 w-full rounded bg-muted animate-pulse" />
      ) : account && !account.available ? (
        <p className="text-sm">Salve o evento para conectar a conta Opa Pingou da comunidade.</p>
      ) : (
        <div className="space-y-4">
          {connection ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
              <p className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Conectada: <span className="font-medium">{connectionLabel(connection)}</span>
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setReplacing((v) => !v);
                    setError(null);
                  }}
                >
                  {replacing ? 'Cancelar troca' : 'Trocar conta'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={busy}
                  onClick={() => setConfirmRemove(true)}
                >
                  Remover
                </Button>
              </div>
            </div>
          ) : account?.legacy ? (
            <p className="text-sm flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              Este evento está cobrando pela conta do Hub Community. Conecte a conta Opa Pingou da
              sua comunidade para receber os pagamentos direto.
            </p>
          ) : (
            <p className="text-sm flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              Sem conta conectada, os lotes pagos deste evento não aceitam inscrição. Os gratuitos
              seguem normalmente.
            </p>
          )}

          {showForm && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="opapingou-api-key">Chave de API do Opa Pingou</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="opapingou-api-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    data-1p-ignore
                    data-lpignore="true"
                    placeholder="opk_live_…"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={busy}
                  />
                  <Button type="button" onClick={handleConnect} disabled={busy || !apiKey.trim()}>
                    {connecting ? 'Conectando…' : 'Conectar'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  A chave fica guardada cifrada e não aparece de novo: depois de salva, só mostramos
                  a empresa e o final da chave.
                </p>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Como gerar a chave</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>
                    Entre no Opa Pingou e abra{' '}
                    <a href={OPAPINGOU_KEYS_URL} target="_blank" rel="noopener noreferrer" className={externalLink}>
                      Chaves de API
                      <ExternalLink className="ml-1 inline h-3 w-3" />
                    </a>{' '}
                    (no app, em Configurações).
                  </li>
                  <li>
                    Crie uma chave nova, de produção, com estas permissões:
                    <ul className="mt-1 list-disc pl-5">
                      {REQUIRED_SCOPES.map((s) => (
                        <li key={s.scope}>{s.label}</li>
                      ))}
                    </ul>
                  </li>
                  <li>Copie a chave (o Opa Pingou mostra uma vez só) e cole aqui.</li>
                </ol>
              </details>

              {reusable.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Ou use uma conta já conectada</p>
                  <ul className="space-y-2">
                    {reusable.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                        <span>{connectionLabel(c)}</span>
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => handleReuse(c.id)}>
                          Usar esta conta
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
        </div>
      )}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover a conta Opa Pingou deste evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Sem conta, os lotes pagos param de aceitar inscrição até você conectar outra. Quem já
              pagou continua inscrito. Se houver Pix em aberto, a remoção espera eles vencerem (até
              15 minutos).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
