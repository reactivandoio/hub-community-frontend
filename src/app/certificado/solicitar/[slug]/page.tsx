'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GET_CERTIFICATE_REQUEST_FORM, SUBMIT_CERTIFICATE_REQUEST } from '@/lib/queries';
import type { CertificateRequestFormResponse, SubmitCertificateRequestResponse } from '@/lib/types';
import { formatCpf, isValidCpf, normalizeIdentifier } from '@/lib/certificate';

function errorMessage(err: unknown): string {
  const graphQLErrors = (err as { graphQLErrors?: { message: string }[] } | undefined)?.graphQLErrors;
  if (graphQLErrors?.length) return graphQLErrors[0].message;
  return 'Não foi possível conectar. Tente novamente.';
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="container max-w-2xl mx-auto py-20 px-4 min-h-[80vh] flex items-center justify-center">
      <Card className="w-full text-center shadow-lg">
        <CardContent className="pt-10 pb-8 flex flex-col items-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">{icon}</div>
          <h2 className="text-3xl font-bold mb-4">{title}</h2>
          <div className="text-muted-foreground text-lg max-w-md space-y-6">{children}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SolicitarCertificadoPage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';

  const { data, loading } = useQuery<CertificateRequestFormResponse>(GET_CERTIFICATE_REQUEST_FORM, {
    variables: { slug },
    skip: !slug,
    fetchPolicy: 'network-only',
  });
  const [submit, { loading: submitting }] =
    useMutation<SubmitCertificateRequestResponse>(SUBMIT_CERTIFICATE_REQUEST);

  const [form, setForm] = useState({ name: '', cpf: '', email: '', phone_number: '', date_of_birth: '' });
  // <input type="date"> já barra o futuro com `max`; o BFF confere de novo.
  const today = new Date().toISOString().slice(0, 10);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const requestForm = data?.certificateRequestForm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidCpf(form.cpf)) {
      setError('CPF inválido.');
      return;
    }
    try {
      const { data: res } = await submit({
        variables: {
          slug,
          name: form.name.trim(),
          identifier: normalizeIdentifier(form.cpf),
          email: form.email.trim(),
          phone: form.phone_number.replace(/\D/g, ''),
          date_of_birth: form.date_of_birth || null,
        },
      });
      if (res?.submitCertificateRequest?.ok) setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!requestForm) {
    return (
      <Message icon={<AlertCircle className="w-10 h-10 text-amber-500" />} title="Formulário não encontrado">
        <p>Confira o link enviado pela organização do evento.</p>
      </Message>
    );
  }

  const { event, category } = requestForm;

  if (!requestForm.enabled) {
    return (
      <Message icon={<AlertCircle className="w-10 h-10 text-amber-500" />} title="Solicitações encerradas">
        <p>Este formulário não está mais aceitando solicitações. Fale com a organização de &quot;{event.title}&quot;.</p>
      </Message>
    );
  }

  if (sent) {
    return (
      <Message icon={<CheckCircle2 className="w-10 h-10 text-primary" />} title="Solicitação enviada">
        <p>
          Sua solicitação de certificado como <strong>{category}</strong> em &quot;{event.title}&quot; foi
          registrada. A organização vai emitir e enviar por e-mail.
        </p>
        {event.slug ? (
          <Link href={`/events/${event.slug}`}>
            <Button size="lg" variant="outline" className="rounded-full">Voltar para o evento</Button>
          </Link>
        ) : null}
      </Message>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-12 px-4 min-h-[80vh] flex items-center justify-center">
      <Card className="w-full shadow-lg border-primary/10">
        <CardHeader className="text-center space-y-2 pb-8">
          <CardTitle className="text-3xl font-bold tracking-tight">{requestForm.title}</CardTitle>
          <CardDescription className="text-base">
            {event.title} · certificado de <strong>{category}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requestForm.description ? (
            <p className="text-sm text-muted-foreground mb-6 whitespace-pre-line">{requestForm.description}</p>
          ) : null}

          {error && (
            <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center space-x-3 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Nome completo (como sairá no certificado)
              </Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={submitting}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-sm font-semibold">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                required
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
                disabled={submitting}
                className="h-12"
                maxLength={14}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth" className="text-sm font-semibold">Data de nascimento</Label>
              <Input
                id="date_of_birth"
                type="date"
                required
                max={today}
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                disabled={submitting}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={submitting}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number" className="text-sm font-semibold">WhatsApp</Label>
              <Input
                id="phone_number"
                type="tel"
                required
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                disabled={submitting}
                className="h-12"
                maxLength={15}
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-medium" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
              Enviar solicitação
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
