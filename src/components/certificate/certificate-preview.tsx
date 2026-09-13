'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import * as pdfjsLib from 'pdfjs-dist';
import { CertificateDocument } from '@/components/certificate/certificate-document';
import { generateQrDataUrl } from '@/lib/certificate-qr';
import { verifyUrl, type CertificateConfigLike, type CertificateEventInfo } from '@/lib/certificate';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// The pdf.js worker is a separate asset; `new URL(..., import.meta.url)` lets Turbopack/webpack
// bundle it and give us a stable URL. Set once at module scope (this module is browser-only).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// Cap the backing-store scale: an A4 landscape frame at ~1200px CSS width x3 is already plenty.
const MAX_PIXEL_RATIO = 3;

interface CertificatePreviewProps {
  config: CertificateConfigLike;
  event: CertificateEventInfo;
  certificate: { code: string; name: string };
}

interface RenderInput {
  config: CertificateConfigLike;
  event: CertificateEventInfo;
  certificate: { code: string; name: string };
  url: string;
  qrDataUrl: string;
}

// Heavy module (react-pdf + pdf.js). Consumers must load this with next/dynamic({ ssr: false }).
export default function CertificatePreview({ config, event, certificate }: CertificatePreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [hasFrame, setHasFrame] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Monotonic token: a render only commits its frame if it is still the latest one.
  const renderIdRef = useRef(0);
  const inputRef = useRef<RenderInput | null>(null);

  const url = verifyUrl(certificate.code);

  // Consumers pass inline object literals; key on content so a parent re-render does not
  // trigger a full PDF regeneration when nothing actually changed.
  const inputKey = useMemo(
    () => JSON.stringify({ config, event, code: certificate.code, name: certificate.name, url, qrDataUrl }),
    [config, event, certificate.code, certificate.name, url, qrDataUrl],
  );
  inputRef.current = qrDataUrl === null ? null : { config, event, certificate, url, qrDataUrl };

  useEffect(() => {
    let active = true;
    generateQrDataUrl(url)
      .then((data) => {
        if (active) setQrDataUrl(data);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [url]);

  // Track the wrapper width so the page is rasterised at the exact displayed size.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const next = Math.round(el.clientWidth); // content box (excludes the border)
      setWidth((prev) => (prev === next ? prev : next));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    const canvas = canvasRef.current;
    if (!input || !canvas || width <= 0) return;

    const renderId = ++renderIdRef.current;
    const isStale = () => renderId !== renderIdRef.current;
    setUpdating(true);

    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let renderTask: pdfjsLib.RenderTask | null = null;
    let disposed = false;
    // Frees the worker-side document (and aborts a load still in flight). Idempotent.
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      renderTask?.cancel();
      renderTask = null;
      void loadingTask?.destroy().catch(() => undefined);
    };

    const run = async () => {
      const blob = await pdf(
        <CertificateDocument
          config={input.config}
          event={input.event}
          certificate={input.certificate}
          verifyUrl={input.url}
          qrDataUrl={input.qrDataUrl}
        />,
      ).toBlob();
      if (isStale()) return;

      const data = new Uint8Array(await blob.arrayBuffer());
      if (isStale()) return;

      loadingTask = pdfjsLib.getDocument({ data });
      const doc = await loadingTask.promise;
      if (isStale()) return;

      const page = await doc.getPage(1);
      if (isStale()) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width * pixelRatio) / base.width });

      // Rasterise offscreen so the visible canvas keeps the previous frame until the new
      // one is complete (no blank/flicker between updates).
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.ceil(viewport.width);
      offscreen.height = Math.ceil(viewport.height);

      renderTask = page.render({ canvas: offscreen, viewport });
      await renderTask.promise;
      if (isStale()) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context unavailable');
      // Resizing clears the canvas, but the drawImage below runs synchronously in the same
      // task, so the browser never paints an empty frame.
      if (canvas.width !== offscreen.width || canvas.height !== offscreen.height) {
        canvas.width = offscreen.width;
        canvas.height = offscreen.height;
      }
      // Pin the CSS box to the rasterised aspect so the bitmap is never stretched,
      // regardless of how the wrapper's height resolves.
      canvas.style.width = `${width}px`;
      canvas.style.height = `${Math.round(offscreen.height / pixelRatio)}px`;
      ctx.drawImage(offscreen, 0, 0);

      setHasFrame(true);
      setError(false);
    };

    run()
      .catch((err: unknown) => {
        if (isStale() || err instanceof pdfjsLib.RenderingCancelledException) return;
        console.error('[certificate-preview] render failed', err);
        setError(true);
      })
      .finally(() => {
        if (!isStale()) setUpdating(false);
        // The frame (if any) has already been copied to the visible canvas.
        dispose();
      });

    return () => {
      // Invalidate this render; a newer effect run (or unmount) supersedes it.
      if (renderIdRef.current === renderId) renderIdRef.current += 1;
      dispose();
    };
  }, [inputKey, width]);

  const showSkeleton = !hasFrame && !error;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden rounded-lg border bg-white"
      // Before the first frame there is no canvas bitmap to size the box; reserve the A4
      // landscape height so the skeleton has the right shape. Afterwards the wrapper is
      // exactly as tall as the canvas (its only in-flow child).
      style={!hasFrame && width > 0 ? { minHeight: Math.round((width * 210) / 297) } : undefined}
      aria-busy={updating}
    >
      <canvas
        ref={canvasRef}
        aria-label="Pré-visualização do certificado"
        role="img"
        className={cn('block transition-opacity duration-200', updating && hasFrame && 'opacity-80')}
      />
      {showSkeleton ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
      {updating && hasFrame ? (
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow-sm">
          Atualizando…
        </span>
      ) : null}
      {error ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2">
          <span className="rounded-md bg-destructive/90 px-3 py-1 text-xs text-destructive-foreground shadow-sm">
            Não foi possível gerar a pré-visualização.
          </span>
        </div>
      ) : null}
    </div>
  );
}
