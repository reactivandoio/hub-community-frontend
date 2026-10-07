/**
 * "Me inscrevi" share art — browser-only image helpers (canvas + html-to-image).
 * Every image handed to the template is a data URL: blob: URLs and cross-origin URLs do not
 * survive html-to-image's DOM clone, and Safari renders them black.
 */
import { SHARE_ART_PHOTO_MAX, fitWithin } from '@/lib/share-art';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('Não foi possível carregar a imagem.'));
    image.src = src;
  });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Downscale a picked photo (phones produce 8MB+ files that make html-to-image time out). */
export async function preparePhoto(file: File): Promise<string> {
  const image = await loadImage(await readAsDataUrl(file));
  const { width, height } = fitWithin(
    image.naturalWidth,
    image.naturalHeight,
    SHARE_ART_PHOTO_MAX
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/** Crop `src` to the area chosen in react-easy-crop and burn the CSS `filter` into the pixels. */
export async function cropPhoto(
  src: string,
  area: { x: number; y: number; width: number; height: number },
  filter: string
): Promise<string> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.filter = filter;
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Fetch a same-origin image as a data URL; null when it cannot be read. */
export async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await readAsDataUrl(blob);
  } catch {
    return null;
  }
}

interface Size {
  width: number;
  height: number;
}

/**
 * Render `node`, laid out at `layout` CSS pixels, to a PNG of exactly `output` pixels.
 * Sizes are passed in instead of measured so a squeezed or scaled node cannot change the output.
 */
export async function exportNodeToPng(
  node: HTMLElement,
  layout: Size,
  output: Size
): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  const options = {
    width: layout.width,
    height: layout.height,
    canvasWidth: output.width,
    canvasHeight: output.height,
    pixelRatio: 1,
    cacheBust: false,
  };
  // Safari decodes the images embedded in the SVG foreignObject too late on the first call and
  // returns a blank/black image; the first render only warms its cache.
  // https://github.com/bubkoo/html-to-image/issues/361
  await toBlob(node, options);
  const blob = await toBlob(node, options);
  if (!blob) throw new Error('Não foi possível gerar a imagem.');
  return blob;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Native share sheet with the PNG only (some apps drop the file when text comes along);
 * false when the browser cannot share files. Must run inside the click handler.
 */
export async function shareImage(
  blob: Blob,
  fileName: string
): Promise<boolean> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (
    typeof navigator === 'undefined' ||
    !navigator.canShare?.({ files: [file] })
  )
    return false;
  try {
    await navigator.share({ files: [file] });
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') throw err;
  }
  return true;
}

const BFF_URL = (
  process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4001/graphql'
).replace('/graphql', '');

/**
 * Save the generated art in the CMS through the BFF `/upload` route (same one the profile page uses),
 * reporting progress 0–100. Resolves with the public URL.
 */
export function uploadShareArt(
  blob: Blob,
  fileName: string,
  onProgress: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', new File([blob], fileName, { type: 'image/png' }));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BFF_URL}/upload`);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded * 100) / e.total));
    };
    xhr.onload = () => {
      let body: { url?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error page
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.url) {
        onProgress(100);
        resolve(body.url);
      } else {
        reject(new Error(body.error || `Falha no envio (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('Falha de rede no envio.'));
    xhr.send(formData);
  });
}
