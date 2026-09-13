import React from 'react';
import { print, type DocumentNode } from 'graphql';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { CertificateDocument } from '@/components/certificate/certificate-document';
import { registerSignatureFonts } from '@/lib/certificate-fonts';
import { generateQrDataUrl } from '@/lib/certificate-qr';
import { verifyUrl } from '@/lib/certificate';
import { GET_CERTIFICATE_BY_CODE, GET_CERTIFICATE_CONFIG } from '@/lib/queries';
import type {
  CertificateByCodeResponse,
  CertificateConfig,
  CertificateConfigResponse,
  CertificateEvent,
  PublicCertificate,
} from '@/lib/types';

const GRAPHQL_URL =
  process.env.GRAPHQL_URL || process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';

export async function graphqlRequest<T>(
  document: DocumentNode,
  variables: Record<string, unknown>,
  authorization?: string,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify({ query: print(document), variables }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Erro ao consultar o BFF (HTTP ${res.status})`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message || 'Erro no BFF');
  }
  return json.data as T;
}

export interface CertificateBundle {
  certificate: PublicCertificate;
  config: CertificateConfig;
  event: CertificateEvent;
}

const EMPTY_CONFIG: CertificateConfig = {
  enabled: false,
  allow_self_request: true,
  sponsors: [],
  signatures: [],
};

/**
 * `cache` lets callers that fetch several certificates in one request (the ZIP route) memoise
 * `certificateConfig` per `eventId`, so a batch of codes for the same event only fetches the
 * config once. Pass nothing for a single-certificate fetch (the PDF route).
 */
const PRODUCTION_SITE_URL = 'https://hubcommunity.io';

/**
 * Public base URL used inside certificates (verify link + QR). Behind a reverse
 * proxy `request.nextUrl.origin` is the internal listener (e.g. http://localhost:4010),
 * so prefer the configured site URL, then the forwarded host, and never emit a
 * localhost address from a production build.
 */
export function siteBaseUrl(request: { headers: Headers; nextUrl: { origin: string } }): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    return `${proto}://${forwardedHost}`;
  }
  const origin = request.nextUrl.origin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin);
  return isLocal && process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : origin;
}

export async function fetchCertificateBundle(
  code: string,
  cache?: Map<string, Promise<CertificateConfig | null>>,
): Promise<CertificateBundle | null> {
  const { certificateByCode } = await graphqlRequest<CertificateByCodeResponse>(GET_CERTIFICATE_BY_CODE, { code });
  if (!certificateByCode || certificateByCode.revoked_at || !certificateByCode.event) return null;

  const eventId = certificateByCode.event.documentId || certificateByCode.event.id;
  const fetchConfig = () =>
    graphqlRequest<CertificateConfigResponse>(GET_CERTIFICATE_CONFIG, { eventId }).then((r) => r.certificateConfig);

  let configPromise = cache?.get(eventId);
  if (!configPromise) {
    configPromise = fetchConfig();
    cache?.set(eventId, configPromise);
  }
  const certificateConfig = await configPromise;

  return {
    certificate: certificateByCode,
    config: certificateConfig || EMPTY_CONFIG,
    event: certificateByCode.event,
  };
}

export async function renderCertificatePdf(bundle: CertificateBundle, baseUrl: string): Promise<Buffer> {
  const url = verifyUrl(bundle.certificate.code, baseUrl);
  const qrDataUrl = await generateQrDataUrl(url);
  // Cursive signature fonts must be registered before the tree is laid out.
  registerSignatureFonts({ server: true });
  const element = React.createElement(CertificateDocument, {
    config: bundle.config,
    event: bundle.event,
    certificate: { code: bundle.certificate.code, name: bundle.certificate.name },
    verifyUrl: url,
    qrDataUrl,
    server: true,
  });
  return renderToBuffer(element as React.ReactElement<DocumentProps>);
}
