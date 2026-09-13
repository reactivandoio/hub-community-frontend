// Registers the cursive signature fonts with react-pdf. This module imports
// @react-pdf/renderer, so — like certificate-document.tsx — it may only be imported
// from certificate-document.tsx, certificate-preview.tsx and server modules.
// Metadata (SIGNATURE_FONTS etc.) lives in certificate-fonts-meta.ts and is re-exported here.
import { Font } from '@react-pdf/renderer';
import { SIGNATURE_FONTS, type SignatureFont } from '@/lib/certificate-fonts-meta';

export * from '@/lib/certificate-fonts-meta';

const registered = new Set<string>();

/**
 * Idempotently registers the three signature fonts. On the server the source is an
 * absolute path under `public/fonts` (string concat — no `path` import, so the module
 * stays browser-safe); in the browser it is a URL react-pdf fetches on demand.
 */
export function registerSignatureFonts(opts: { server: boolean; baseUrl?: string }): void {
  const server = opts.server && typeof window === 'undefined';
  for (const key of Object.keys(SIGNATURE_FONTS) as SignatureFont[]) {
    const { family, file } = SIGNATURE_FONTS[key];
    if (registered.has(family)) continue;
    const src = server ? `${process.cwd()}/public/fonts/${file}` : `${opts.baseUrl ?? ''}/fonts/${file}`;
    Font.register({ family, src });
    registered.add(family);
  }
}
