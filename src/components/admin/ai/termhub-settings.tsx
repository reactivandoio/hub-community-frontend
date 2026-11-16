'use client';

import { useMutation, useQuery, type ApolloCache } from '@apollo/client';
import { CheckCircle2, KeyRound, Trash2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { AdminPageError, AdminPageLoading } from '@/components/admin/admin-page';
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
import { formatVerifiedAt, readError, safeReturnTo } from '@/lib/ai-text';
import {
  DELETE_TERMHUB_SETTINGS,
  GET_TERMHUB_SETTINGS,
  SAVE_TERMHUB_SETTINGS,
  TEST_TERMHUB_SETTINGS,
} from '@/lib/queries';
import type { TermhubSettings } from '@/lib/types';

export const TERMHUB_FORM_ID = 'termhub-settings-form';

type SettingsData = { termhubSettings: TermhubSettings };

/**
 * REA-51: the signed-in admin user's termhub token and project. The token is typed here once,
 * sent to the BFF, tested there and stored encrypted; it never comes back (only its last 4
 * characters) and is cleared from this form after saving.
 */
export function TermhubSettingsPanel({ returnTo }: { returnTo?: string | null }) {
  const router = useRouter();
  const back = safeReturnTo(returnTo);
  const [token, setToken] = useState('');
  const [project, setProject] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, error: loadError } = useQuery<SettingsData>(GET_TERMHUB_SETTINGS, { fetchPolicy: 'cache-and-network' });
  const update = { update: (cache: ApolloCache<unknown>, result: { data?: Record<string, TermhubSettings> | null }) => {
    const settings = result.data && Object.values(result.data)[0];
    if (settings) cache.writeQuery({ query: GET_TERMHUB_SETTINGS, data: { termhubSettings: settings } });
  } };
  const [save, saving] = useMutation(SAVE_TERMHUB_SETTINGS, update);
  const [test, testing] = useMutation(TEST_TERMHUB_SETTINGS, update);
  const [remove, removing] = useMutation(DELETE_TERMHUB_SETTINGS, update);

  if (loading && !data) return <AdminPageLoading label="Carregando configuração de IA" />;
  if (loadError && !data) return <AdminPageError title="Não foi possível carregar a configuração" message={loadError.message} />;

  const settings = data?.termhubSettings;
  const projectValue = project ?? settings?.project ?? '';
  const verifiedAt = formatVerifiedAt(settings?.verified_at);
  const busy = saving.loading || testing.loading || removing.loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await save({ variables: { input: { token: token.trim() || null, project: projectValue.trim() } } });
      setToken('');
      setProject(null);
      toast.success('Token testado e salvo.');
      if (back) router.push(back);
    } catch (err) {
      setError(readError(err).message);
    }
  };

  const onTest = async () => {
    setError(null);
    try {
      await test();
      toast.success('O termhub aceitou o token neste projeto.');
    } catch (err) {
      setError(readError(err).message);
    }
  };

  const onDelete = async () => {
    try {
      await remove();
      toast.success('Token removido.');
    } catch (err) {
      toast.error(readError(err).message);
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-6">
        {settings && !settings.server_ready && (
          <p role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            A IA ainda não está disponível neste servidor (falta a chave TERMHUB_TOKEN_KEY). Nada pode ser salvo até lá.
          </p>
        )}

        {settings?.configured ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="space-y-0.5 text-sm">
                <p className="font-medium">Token salvo {settings.token_hint} · projeto {settings.project}</p>
                {verifiedAt && <p className="text-muted-foreground">Testado em {verifiedAt}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onTest} disabled={busy}>
                <Wand2 className="mr-2 h-4 w-4" /> {testing.loading ? 'Testando…' : 'Testar de novo'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Trash2 className="mr-2 h-4 w-4" /> Remover
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Você ainda não salvou um token do termhub.</p>
        )}

        <form id={TERMHUB_FORM_ID} onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="termhub-token">{settings?.configured ? 'Novo token (opcional)' : 'Token do termhub'}</Label>
            <Input
              id="termhub-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              placeholder={settings?.configured ? 'Em branco mantém o token salvo' : 'Cole o token com o escopo runs'}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="termhub-project">Projeto do termhub</Label>
            <Input
              id="termhub-project"
              value={projectValue}
              placeholder="Chave ou id do projeto, ex.: TER"
              onChange={(e) => setProject(e.target.value)}
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={busy || !settings?.server_ready || !projectValue.trim() || (!settings?.configured && !token.trim())}
            >
              <KeyRound className="mr-2 h-4 w-4" /> {saving.loading ? 'Testando…' : 'Salvar e testar'}
            </Button>
            {back && (
              <Button type="button" variant="ghost" onClick={() => router.push(back)}>
                Voltar ao e-mail marketing
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            O token é testado no termhub (sem gastar uma run) antes de ser salvo, fica guardado criptografado no
            servidor e nunca volta para esta tela.
          </p>
        </form>
      </div>

      <aside className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <h2 className="font-semibold">Como criar o token</h2>
        <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
          <li>
            Entre no termhub ({settings?.base_url || 'https://termhub.dev'}) com a sua conta e crie um <strong>token
            pessoal</strong> com o escopo <strong>runs</strong> (só esse).
          </li>
          <li>Copie o token na hora (o termhub só mostra uma vez) e cole aqui.</li>
          <li>
            Em <strong>Projeto</strong>, informe a chave (ex.: TER) ou o id do projeto do termhub em que as runs vão rodar.
            Uma máquina com o agente do termhub e uma conta de IA precisa estar ligada a esse projeto.
          </li>
        </ol>
        <p className="text-muted-foreground">
          Cada geração é uma run só de leitura. Limite do termhub: 2 ao mesmo tempo e 30 por hora por token. A IA só
          escreve um rascunho: você revisa e decide se envia.
        </p>
      </aside>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o token do termhub?</AlertDialogTitle>
            <AlertDialogDescription>
              O botão “Gerar texto com IA” volta a pedir a configuração. O token continua válido no termhub: revogue lá
              se não for mais usá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); onDelete(); }} disabled={removing.loading}>
              {removing.loading ? 'Removendo…' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
