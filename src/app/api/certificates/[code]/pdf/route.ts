import { NextRequest, NextResponse } from 'next/server';
import { fetchCertificateBundle, renderCertificatePdf, siteBaseUrl } from '@/lib/certificate-server';
import { certificateFileName } from '@/lib/certificate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Renders a certificate PDF on the server. Stable link used in e-mails.
 * GET /api/certificates/RCT-XXXXXXXX/pdf
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  let bundle;
  try {
    bundle = await fetchCertificateBundle(code.toUpperCase());
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao buscar certificado' }, { status: 502 });
  }
  if (!bundle) {
    return NextResponse.json({ error: 'Certificado não encontrado ou revogado' }, { status: 404 });
  }

  try {
    const baseUrl = siteBaseUrl(request);
    const pdf = await renderCertificatePdf(bundle, baseUrl);
    const filename = certificateFileName(bundle.event, bundle.certificate.name);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: any) {
    console.error('Certificate render error:', error);
    return NextResponse.json({ error: 'Não foi possível gerar o PDF. Verifique as imagens do modelo.' }, { status: 502 });
  }
}
