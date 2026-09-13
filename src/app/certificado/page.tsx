'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { AlertCircle, Clock, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CertificateCard } from '@/components/certificate/certificate-card';
import { GET_CERTIFICATE_CONFIG, GET_EVENT_BY_SLUG_OR_ID, LOOKUP_CERTIFICATE, REQUEST_CERTIFICATE } from '@/lib/queries';
import type {
  Certificate,
  CertificateConfigResponse,
  EventResponse,
  LookupCertificateResponse,
  RequestCertificateResponse,
} from '@/lib/types';
import { formatCpf, isValidCpf, normalizeIdentifier } from '@/lib/certificate';
import { adjustToBrazilTimezone } from '@/utils/event';

export default function CertificadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <CertificadoContent />
    </Suspense>
  );
}

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
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">{icon}</div>
          <h2 className="text-3xl font-bold mb-4">{title}</h2>
          <div className="text-muted-foreground text-lg max-w-md space-y-6">{children}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function CertificadoContent() {
  const searchParams = useSearchParams();
  const eventParam = searchParams.get('event') || '';

  const { data: eventData, loading: eventLoading } = useQuery<EventResponse>(GET_EVENT_BY_SLUG_OR_ID, {
    variables: { slugOrId: eventParam },
    skip: !eventParam,
  });
  const event = eventData?.eventBySlugOrId;
  const eventId = event?.documentId || event?.id;

  const { data: configData, loading: configLoading } = useQuery<CertificateConfigResponse>(GET_CERTIFICATE_CONFIG, {
    variables: { eventId },
    skip: !eventId,
  });
  const config = configData?.certificateConfig;

  const [cpf, setCpf] = useState('');
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'not_found_allowed' | 'not_found_blocked' | 'revoked'>(
    'idle',
  );
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone_number: '' });

  const [lookup, { loading: lookingUp }] = useLazyQuery<LookupCertificateResponse>(LOOKUP_CERTIFICATE, {
    fetchPolicy: 'network-only',
  });
  const [requestCertificate, { loading: requesting }] = useMutation<RequestCertificateResponse>(REQUEST_CERTIFICATE);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidCpf(cpf)) {
      setError('CPF inválido.');
      return;
    }
    const { data, error: qError } = await lookup({ variables: { eventId, identifier: normalizeIdentifier(cpf) } });
    if (qError) {
      setError(errorMessage(qError));
      return;
    }
    const result = data?.lookupCertificate;
    if (result?.revoked) {
      setLookupState('revoked');
      return;
    }
    if (result?.certificate) {
      setCertificate(result.certificate);
      return;
    }
    setLookupState(result?.self_request_allowed ? 'not_found_allowed' : 'not_found_blocked');
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await requestCertificate({
        variables: {
          eventId,
          name: form.name.trim(),
          identifier: normalizeIdentifier(cpf),
          email: form.email.trim(),
          phone: form.phone_number.replace(/\D/g, ''),
        },
      });
      if (data?.requestCertificate) setCertificate(data.requestCertificate);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!eventParam) {
    return (
      <Message icon={<AlertCircle className="w-10 h-10 text-amber-500" />} title="Evento não informado">
        <p>Acesse o link de certificado enviado pela organização do evento.</p>
      </Message>
    );
  }

  if (eventLoading || configLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <Message icon={<AlertCircle className="w-10 h-10 text-amber-500" />} title="Evento não encontrado">
        <p>Confira o link enviado pela organização.</p>
      </Message>
    );
  }

  if (event.end_date && new Date() <= adjustToBrazilTimezone(new Date(event.end_date))) {
    return (
      <Message icon={<Clock className="w-10 h-10 text-amber-500" />} title="Evento em andamento">
        <p>O certificado estará disponível após a conclusão do evento "{event.title}".</p>
        <Link href={`/events/${event.slug || eventId}`}>
          <Button size="lg" variant="outline" className="rounded-full">Voltar para o evento</Button>
        </Link>
      </Message>
    );
  }

  if (!config?.enabled) {
    return (
      <Message icon={<Clock className="w-10 h-10 text-amber-500" />} title="Certificados ainda não disponíveis">
        <p>A organização de "{event.title}" ainda não liberou os certificados. Tente novamente mais tarde.</p>
      </Message>
    );
  }

  if (certificate) {
    return (
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <CertificateCard certificate={certificate} config={config} showPreview />
      </div>
    );
  }

  if (lookupState === 'not_found_blocked') {
    return (
      <Message icon={<Search className="w-10 h-10 text-amber-500" />} title="Participação não encontrada">
        <p>Não encontramos sua participação em "{event.title}" com o CPF {formatCpf(cpf)}. Fale com a organização do evento.</p>
        <Button variant="outline" onClick={() => setLookupState('idle')}>Tentar outro CPF</Button>
      </Message>
    );
  }

  if (lookupState === 'revoked') {
    return (
      <Message icon={<AlertCircle className="w-10 h-10 text-red-500" />} title="Certificado revogado">
        <p>Este certificado foi revogado. Fale com a organização do evento.</p>
        <Button variant="outline" onClick={() => setLookupState('idle')}>Tentar outro CPF</Button>
      </Message>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-12 px-4 min-h-[80vh] flex items-center justify-center">
      <Card className="w-full shadow-lg border-primary/10">
        <CardHeader className="text-center space-y-2 pb-8">
          <CardTitle className="text-3xl font-bold tracking-tight">Certificado de participação</CardTitle>
          <CardDescription className="text-base">{event.title}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center space-x-3 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {lookupState === 'idle' ? (
            <form onSubmit={handleLookup} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-semibold">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  required
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  disabled={lookingUp}
                  className="h-12"
                  maxLength={14}
                  inputMode="numeric"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-medium" disabled={lookingUp}>
                {lookingUp ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                Buscar meu certificado
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRequest} className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Não encontramos sua presença registrada. Preencha seus dados para emitir o certificado.
              </p>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">Nome completo (como sairá no certificado)</Label>
                <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={requesting} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">CPF</Label>
                <Input value={formatCpf(cpf)} disabled className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">E-mail</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={requesting} className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number" className="text-sm font-semibold">WhatsApp</Label>
                <Input id="phone_number" type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} disabled={requesting} className="h-12" maxLength={15} />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="h-12" onClick={() => { setLookupState('idle'); setError(''); }} disabled={requesting}>Voltar</Button>
                <Button type="submit" className="flex-1 h-12 text-lg font-medium" disabled={requesting}>
                  {requesting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  Emitir certificado
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
