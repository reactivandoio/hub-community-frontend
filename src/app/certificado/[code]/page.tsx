'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CertificateCard } from '@/components/certificate/certificate-card';
import { Card, CardContent } from '@/components/ui/card';
import { GET_CERTIFICATE_BY_CODE, GET_CERTIFICATE_CONFIG } from '@/lib/queries';
import type { CertificateByCodeResponse, CertificateConfigResponse } from '@/lib/types';

export default function CertificadoPorCodigoPage() {
  const params = useParams();
  const code = String(params?.code || '').toUpperCase();

  const { data, loading, error, refetch } = useQuery<CertificateByCodeResponse>(GET_CERTIFICATE_BY_CODE, {
    variables: { code },
    skip: !code,
  });
  const certificate = data?.certificateByCode;
  const eventId = certificate?.event?.documentId || certificate?.event?.id;

  const { data: configData } = useQuery<CertificateConfigResponse>(GET_CERTIFICATE_CONFIG, {
    variables: { eventId },
    skip: !eventId,
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
            <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Não foi possível carregar o certificado</h2>
            <p className="text-muted-foreground mb-6">Tente novamente em instantes.</p>
            <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!certificate || certificate.revoked_at) {
    return (
      <div className="container max-w-2xl mx-auto py-20 px-4">
        <Card className="text-center">
          <CardContent className="pt-10 pb-8 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Certificado não encontrado</h2>
            <p className="text-muted-foreground">
              {certificate?.revoked_at ? 'Este certificado foi revogado.' : `Nenhum certificado com o código ${code}.`}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <CertificateCard certificate={certificate} config={configData?.certificateConfig} showPreview />
    </div>
  );
}
