'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { AlertCircle, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GET_CERTIFICATE_BY_CODE } from '@/lib/queries';
import { formatDate } from '@/lib/certificate';
import type { CertificateByCodeResponse } from '@/lib/types';

export default function VerificarCertificadoPage() {
  const params = useParams();
  const code = String(params?.code || '').toUpperCase();
  const { data, loading, error, refetch } = useQuery<CertificateByCodeResponse>(GET_CERTIFICATE_BY_CODE, {
    variables: { code },
    skip: !code,
  });

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto py-20 px-4">
        <Card className="text-center border-amber-500/30">
          <CardContent className="pt-10 pb-8 flex flex-col items-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
            <h1 className="text-2xl font-bold mb-1">Não foi possível verificar agora</h1>
            <p className="text-muted-foreground mb-6">Tente novamente em instantes.</p>
            <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const certificate = data?.certificateByCode;
  const valid = Boolean(certificate && !certificate.revoked_at);

  return (
    <div className="container max-w-2xl mx-auto py-20 px-4">
      <Card className={`text-center ${valid ? 'border-green-500/30' : 'border-destructive/30'}`}>
        <CardContent className="pt-10 pb-8 flex flex-col items-center">
          {valid ? (
            <ShieldCheck className="w-16 h-16 text-green-500 mb-4" />
          ) : (
            <ShieldX className="w-16 h-16 text-destructive mb-4" />
          )}
          <h1 className="text-2xl font-bold mb-1">
            {valid ? 'Certificado válido' : certificate ? 'Certificado revogado' : 'Certificado não encontrado'}
          </h1>
          <p className="text-xs font-mono text-muted-foreground mb-6">{code}</p>
          {certificate ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-sm">
              <dt className="text-muted-foreground">Participante</dt>
              <dd className="font-medium">{certificate.name}</dd>
              <dt className="text-muted-foreground">Evento</dt>
              <dd className="font-medium">{certificate.event?.title}</dd>
              <dt className="text-muted-foreground">Data do evento</dt>
              <dd>{certificate.event ? formatDate(certificate.event.start_date) : '-'}</dd>
              <dt className="text-muted-foreground">Emitido em</dt>
              <dd>{certificate.issued_at ? formatDate(certificate.issued_at) : '-'}</dd>
            </dl>
          ) : (
            <p className="text-muted-foreground">Confira o código impresso no certificado e tente novamente.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
