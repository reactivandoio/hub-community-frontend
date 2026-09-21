'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Check, Copy, ExternalLink, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_CATEGORY } from '@/lib/certificate';
import {
  CREATE_CERTIFICATE_REQUEST_FORM,
  DELETE_CERTIFICATE_REQUEST_FORM,
  GET_CERTIFICATE_REQUEST_FORMS,
  UPDATE_CERTIFICATE_REQUEST_FORM,
} from '@/lib/queries';
import type {
  CertificateRequestForm,
  CertificateRequestFormsResponse,
  CreateCertificateRequestFormResponse,
  DeleteCertificateRequestFormResponse,
  UpdateCertificateRequestFormResponse,
} from '@/lib/types';

// Starting points for the category field — it stays a free-text input so an event can
// invent its own ("Equipe de apoio", "Jurado"…).
const CATEGORY_SUGGESTIONS = ['Organizador', 'Mentor', 'Palestrante', 'Voluntário', 'Staff'];

interface Draft {
  id?: string;
  title: string;
  category: string;
  description: string;
  enabled: boolean;
}

const EMPTY_DRAFT: Draft = { title: '', category: '', description: '', enabled: true };

function errorMessage(err: unknown): string {
  const graphQLErrors = (err as { graphQLErrors?: { message: string }[] } | undefined)?.graphQLErrors;
  if (graphQLErrors?.length) return graphQLErrors[0].message;
  return 'Não foi possível conectar. Tente novamente.';
}

export function publicFormUrl(slug: string, origin: string): string {
  return `${origin}/certificado/solicitar/${slug}`;
}

interface Props {
  eventId: string;
}

export function CertificateRequestForms({ eventId }: Props) {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useQuery<CertificateRequestFormsResponse>(
    GET_CERTIFICATE_REQUEST_FORMS,
    { variables: { eventId }, fetchPolicy: 'network-only' },
  );
  const [createForm, { loading: creating }] =
    useMutation<CreateCertificateRequestFormResponse>(CREATE_CERTIFICATE_REQUEST_FORM);
  const [updateForm, { loading: updating }] =
    useMutation<UpdateCertificateRequestFormResponse>(UPDATE_CERTIFICATE_REQUEST_FORM);
  const [deleteForm] = useMutation<DeleteCertificateRequestFormResponse>(DELETE_CERTIFICATE_REQUEST_FORM);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CertificateRequestForm | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const forms = data?.certificateRequestForms ?? [];
  const saving = creating || updating;

  const copyLink = async (form: CertificateRequestForm) => {
    const url = publicFormUrl(form.slug, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(form.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar', description: url });
    }
  };

  const save = async () => {
    if (!draft) return;
    const input = {
      title: draft.title.trim(),
      category: draft.category.trim() || DEFAULT_CATEGORY,
      description: draft.description.trim() || null,
      enabled: draft.enabled,
    };
    if (!input.title) {
      toast({ variant: 'destructive', title: 'Título é obrigatório' });
      return;
    }
    try {
      if (draft.id) await updateForm({ variables: { id: draft.id, data: input } });
      else await createForm({ variables: { eventId, data: input } });
      setDraft(null);
      await refetch();
      toast({ title: draft.id ? 'Formulário atualizado' : 'Formulário criado' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: errorMessage(err) });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteForm({ variables: { id: pendingDelete.id } });
      setPendingDelete(null);
      await refetch();
      toast({ title: 'Formulário excluído' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: errorMessage(err) });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (error) return <div className="text-red-500 bg-red-500/10 p-4 rounded-lg">{errorMessage(error)}</div>;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <CardTitle>Formulários de solicitação</CardTitle>
              <CardDescription>
                Um link público por categoria. Quem preencher entra na lista daquela categoria na aba
                Emissão — participantes, organizadores, mentores, cada um na sua.
              </CardDescription>
            </div>
            <Button onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              <Plus className="w-4 h-4 mr-2" />
              Novo formulário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nenhum formulário ainda. A lista de <strong>{DEFAULT_CATEGORY}</strong> continua valendo
              para inscritos e presenças.
            </p>
          ) : (
            <div className="space-y-3">
              {forms.map((form) => (
                <div
                  key={form.id}
                  className="flex flex-col lg:flex-row lg:items-center gap-3 border rounded-lg p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{form.title}</span>
                      <Badge variant="secondary">{form.category}</Badge>
                      {form.enabled ? null : <Badge variant="outline">Desativado</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {form.submissions} solicitação(ões)
                      </span>
                    </div>
                    <code className="text-xs text-muted-foreground break-all">
                      /certificado/solicitar/{form.slug}
                    </code>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyLink(form)} aria-label="Copiar link">
                      {copied === form.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(`/certificado/solicitar/${form.slug}`, '_blank')}
                      aria-label="Abrir formulário"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${form.title}`}
                      onClick={() =>
                        setDraft({
                          id: form.id,
                          title: form.title,
                          category: form.category,
                          description: form.description || '',
                          enabled: form.enabled,
                        })
                      }
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${form.title}`}
                      onClick={() => setPendingDelete(form)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => (open ? null : setDraft(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar formulário' : 'Novo formulário'}</DialogTitle>
            <DialogDescription>
              A categoria é o que separa as listas de emissão e o que o texto do certificado lê em
              {' '}
              <code className="font-mono">{'{{categoria}}'}</code>.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="form-title">Título</Label>
                <Input
                  id="form-title"
                  value={draft.title}
                  placeholder="Solicitação de certificado de organização"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-category">Categoria</Label>
                <Input
                  id="form-category"
                  list="certificate-categories"
                  value={draft.category}
                  placeholder={DEFAULT_CATEGORY}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
                <datalist id="certificate-categories">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Vazio vale como {DEFAULT_CATEGORY}. O link do formulário não muda se a categoria
                  mudar depois.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-description">Descrição (opcional)</Label>
                <Textarea
                  id="form-description"
                  rows={3}
                  value={draft.description}
                  placeholder="Aparece para quem abrir o link."
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <label className="flex items-center justify-between gap-3">
                <div>
                  <Label>Aceitando solicitações</Label>
                  <p className="text-xs text-muted-foreground">
                    Desativado, o link para de aceitar novos envios.
                  </p>
                </div>
                <Switch
                  checked={draft.enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, enabled: Boolean(v) })}
                />
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => (open ? null : setPendingDelete(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir “{pendingDelete?.title}”?</DialogTitle>
            <DialogDescription>
              O link para de funcionar. As {pendingDelete?.submissions} solicitação(ões) já recebidas
              continuam na lista de {pendingDelete?.category}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
