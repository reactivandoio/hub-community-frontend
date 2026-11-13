/**
 * Custom "eu vou" art (REA-43) — drawn on a canvas: the event's background, and the participant's
 * photo inside the photo area with its rounded corners. The admin preview and the participant's PNG
 * use this same function, so what the organizer sees is what the participant downloads.
 *
 * A canvas, not html-to-image: nothing but two images, and no Safari foreignObject quirks.
 */
import {
  areaToPixels,
  coverSource,
  fitTextSize,
  fontSpecOf,
  type ShareArtFont,
  type ShareArtPhotoArea,
  type ShareArtText,
} from '@/lib/share-art-config';

/** The part of CanvasRenderingContext2D used here (lets tests pass a recorder). */
export type ArtContext = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'beginPath'
  | 'closePath'
  | 'moveTo'
  | 'lineTo'
  | 'arcTo'
  | 'clip'
  | 'fill'
  | 'drawImage'
  | 'fillText'
  | 'fillStyle'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'imageSmoothingQuality'
  | 'measureText'
>;

interface Drawable {
  width: number;
  height: number;
}

type ArtImage = CanvasImageSource & Drawable;

/** Rounded rectangle path (ctx.roundRect is missing on older Safari). */
export function roundedRectPath(
  ctx: ArtContext,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(left + r, top);
  ctx.lineTo(left + width - r, top);
  ctx.arcTo(left + width, top, left + width, top + r, r);
  ctx.lineTo(left + width, top + height - r);
  ctx.arcTo(left + width, top + height, left + width - r, top + height, r);
  ctx.lineTo(left + r, top + height);
  ctx.arcTo(left, top + height, left, top + height - r, r);
  ctx.lineTo(left, top + r);
  ctx.arcTo(left, top, left + r, top, r);
  ctx.closePath();
}

export interface DrawCustomArtOptions {
  /** Output size in pixels (1080×1920 / 1080×1350 for the PNG, smaller for a preview). */
  width: number;
  height: number;
  background: ArtImage;
  /** The participant's (or the sample) photo; null draws a "Sua foto" placeholder. */
  photo: ArtImage | null;
  area: ShareArtPhotoArea;
  /** REA-47: the person's name and role, each in its area (an empty text is not drawn). */
  texts?: ArtTextLayer[];
}

/** REA-47: one text of the art (the name or the role) and where/how it goes. */
export interface ArtTextLayer {
  text: string;
  style: ShareArtText;
}

const INTER_FALLBACK = 'Inter, system-ui, sans-serif';

/**
 * The CSS family of the Hub's Inter: next/font gives it a hashed name, applied to <body>, so it is
 * read from there.
 */
function interFamily(): string {
  if (typeof document === 'undefined' || !document.body) return INTER_FALLBACK;
  const family = getComputedStyle(document.body).fontFamily;
  return family && /inter/i.test(family) ? family : INTER_FALLBACK;
}

/** The canvas `font` of a text of the art at `px` pixels. */
export function artFont(font: ShareArtFont, px: number): string {
  const spec = fontSpecOf(font);
  const family = spec.family === 'inter' ? interFamily() : spec.family;
  return `${spec.weight} ${px}px ${family}`;
}

/**
 * Loads the fonts before drawing: a canvas draws with whatever is loaded at that moment, so a
 * cursive font not used anywhere else on the page would come out as the fallback.
 */
export async function loadArtFonts(fonts: ShareArtFont[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.all(
    [...new Set(fonts)].map(font =>
      document.fonts.load(artFont(font, 40), 'Aa').catch(() => [])
    )
  );
}

/** Draws one text in its area: vertically centered, aligned, shrunk to fit the area's width. */
export function drawArtText(
  ctx: ArtContext,
  { text, style }: ArtTextLayer,
  width: number,
  height: number
): void {
  const value = text.trim();
  if (!value) return;
  const rect = areaToPixels(style, width, height);
  const px = fitTextSize(
    size => {
      ctx.font = artFont(style.font, size);
      return ctx.measureText(value).width;
    },
    { size: style.size * width, areaWidth: rect.width, areaHeight: rect.height }
  );
  ctx.font = artFont(style.font, px);
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align;
  ctx.textBaseline = 'middle';
  const x =
    style.align === 'left'
      ? rect.left
      : style.align === 'right'
        ? rect.left + rect.width
        : rect.left + rect.width / 2;
  ctx.fillText(value, x, rect.top + rect.height / 2);
}

/** Draws the custom art on `ctx`. The background already has the format's ratio (checked on upload). */
export function drawCustomArt(
  ctx: ArtContext,
  { width, height, background, photo, area, texts = [] }: DrawCustomArtOptions
): void {
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(background, 0, 0, width, height);

  const rect = areaToPixels(area, width, height);
  ctx.save();
  roundedRectPath(
    ctx,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
    rect.radius
  );
  ctx.clip();
  if (photo) {
    const { sx, sy, sw, sh } = coverSource(
      photo.width,
      photo.height,
      rect.width,
      rect.height
    );
    ctx.drawImage(
      photo,
      sx,
      sy,
      sw,
      sh,
      rect.left,
      rect.top,
      rect.width,
      rect.height
    );
  } else {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `600 ${Math.max(10, Math.round(Math.min(rect.width, rect.height) / 9))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'SUA FOTO',
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }
  ctx.restore();

  texts.forEach(layer => {
    ctx.save();
    drawArtText(ctx, layer, width, height);
    ctx.restore();
  });
}

export function loadArtImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('Não foi possível carregar a imagem.'));
    image.src = src;
  });
}

/** Renders the custom art to a PNG of exactly `width`×`height`. Images must be same-origin or data URLs. */
export async function exportCustomArt(
  options: DrawCustomArtOptions
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  await loadArtFonts((options.texts ?? []).map(layer => layer.style.font));
  drawCustomArt(ctx, options);
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('Não foi possível gerar a imagem.');
  return blob;
}

/** Reads the pixel size of a picked file before it is uploaded. */
export async function readImageSize(
  file: File
): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadArtImage(url);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The sample photo of the admin preview: an illustrated portrait, so the organizer sees how a
 * face sits in the area without uploading anyone's photo.
 */
export const SAMPLE_PHOTO_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#f9a8d4"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <path d="M120 1000c0-190 120-330 280-330s280 140 280 330z" fill="#0f766e"/>
  <rect x="345" y="560" width="110" height="130" rx="40" fill="#c08457"/>
  <ellipse cx="400" cy="430" rx="165" ry="190" fill="#d4a373"/>
  <path d="M232 420c-10-170 90-250 175-250 110 0 185 80 170 245-30-70-90-110-170-120-80 10-140 50-175 125z" fill="#3f2a1d"/>
  <circle cx="340" cy="450" r="14" fill="#2b2118"/><circle cx="460" cy="450" r="14" fill="#2b2118"/>
  <path d="M345 535q55 45 110 0" stroke="#7c2d12" stroke-width="12" fill="none" stroke-linecap="round"/>
</svg>`
)}`;
