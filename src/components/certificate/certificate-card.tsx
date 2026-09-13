'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Award, Download, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/certificate';
import type { CertificateConfig, PublicCertificate } from '@/lib/types';

const CertificatePreview = dynamic(() => import('@/components/certificate/certificate-preview'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[480px]" />,
});

interface CertificateCardProps {
  certificate: PublicCertificate;
  config?: CertificateConfig | null;
  showPreview?: boolean;
}

export function CertificateCard({ certificate, config, showPreview = false }: CertificateCardProps) {
  const event = certificate.event;
  return (
    <Card className="shadow-lg border-primary/10">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <Award className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">{certificate.name}</CardTitle>
        {event ? (
          <p className="text-muted-foreground">
            {event.title} · {formatDate(event.start_date)}
            {formatDate(event.end_date) !== formatDate(event.start_date) ? ` a ${formatDate(event.end_date)}` : ''}
          </p>
        ) : null}
        <p className="text-xs font-mono text-muted-foreground mt-2">Código {certificate.code}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {showPreview && config && event ? (
          <CertificatePreview
            config={config}
            event={event}
            certificate={{ code: certificate.code, name: certificate.name }}
          />
        ) : null}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <a href={`/api/certificates/${certificate.code}/pdf`}>
              <Download className="w-4 h-4 mr-2" />
              Baixar PDF
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/certificado/verificar/${certificate.code}`}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Verificar autenticidade
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
