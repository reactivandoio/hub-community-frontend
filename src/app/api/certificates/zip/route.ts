import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { fetchCertificateBundle, renderCertificatePdf, siteBaseUrl, type CertificateBundle } from '@/lib/certificate-server';
import { certificateFileName } from '@/lib/certificate';
import type { CertificateConfig } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_CODES = 500;
const CONCURRENCY = 4;

interface ChunkResult {
  code: string;
  bundle: CertificateBundle | null;
  pdf: Buffer | null;
  error: string | null;
}

/**
 * POST { codes: string[] } -> ZIP with one PDF per certificate.
 * Requires the admin's Authorization header (presence only: each code is unguessable
 * and already public via /certificado/[code]).
 */
export async function POST(request: NextRequest) {
  if (!request.headers.get('authorization')) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let codes: string[] = [];
  try {
    const body = await request.json();
    codes = Array.isArray(body?.codes) ? body.codes.map((c: unknown) => String(c).toUpperCase()) : [];
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }
  if (codes.length === 0 || codes.length > MAX_CODES) {
    return NextResponse.json({ error: `Informe entre 1 e ${MAX_CODES} códigos` }, { status: 400 });
  }

  const uniqueCodes = Array.from(new Set(codes));
  const baseUrl = siteBaseUrl(request);
  const zip = new JSZip();
  const usedNames = new Set<string>();
  // Memoises certificateConfig per eventId for the lifetime of this request, so a batch of
  // codes for the same event only fetches the config once.
  const configCache = new Map<string, Promise<CertificateConfig | null>>();

  for (let i = 0; i < uniqueCodes.length; i += CONCURRENCY) {
    const chunk = uniqueCodes.slice(i, i + CONCURRENCY);
    const results: ChunkResult[] = await Promise.all(
      chunk.map(async (code): Promise<ChunkResult> => {
        try {
          const bundle = await fetchCertificateBundle(code, configCache);
          if (!bundle) return { code, bundle: null, pdf: null, error: null }; // revoked or unknown: skip
          const pdf = await renderCertificatePdf(bundle, baseUrl);
          return { code, bundle, pdf, error: null };
        } catch (error: any) {
          console.error(`ZIP render error for ${code}:`, error);
          return { code, bundle: null, pdf: null, error: error?.message || 'Falha ao renderizar' };
        }
      }),
    );

    for (const result of results) {
      if (result.error) {
        return NextResponse.json({ error: `Falha ao gerar o certificado ${result.code}`, code: result.code }, { status: 502 });
      }
      if (!result.bundle || !result.pdf) continue; // revoked or unknown: skip, the UI already filtered
      let name = certificateFileName(result.bundle.event, result.bundle.certificate.name);
      if (usedNames.has(name)) name = name.replace(/\.pdf$/, `-${result.code}.pdf`);
      usedNames.add(name);
      zip.file(name, result.pdf);
    }
  }

  if (usedNames.size === 0) {
    return NextResponse.json(
      { error: 'Nenhum certificado válido encontrado para os códigos informados.' },
      { status: 404 },
    );
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="certificados.zip"',
      'Cache-Control': 'private, no-store',
    },
  });
}
