/**
 * Custom "eu vou" art of an event (REA-43) — pure rules, no DOM.
 *
 * The organizer picks, per format, a background image and the area where the participant's photo
 * goes. The area is kept in fractions of the background (0 to 1), so it does not depend on the
 * image resolution; `radius` goes from 0 (square corners) to 1 (half of the smaller side: a circle
 * when the area is square). The BFF (`resolvers/ShareArt/rules.js`) has the same numbers and is the
 * one that decides; these give the admin the answer before the upload.
 *
 * Drawing lives in `lib/share-art-custom.ts`; the admin editor in `components/admin/share-art-config-form.tsx`.
 */
import { SHARE_ART_FORMATS, type ShareArtFormat } from '@/lib/share-art';

/** A rectangle in fractions of the background (0 to 1). */
export interface ShareArtRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShareArtPhotoArea extends ShareArtRect {
  radius: number;
}

/** REA-47: fonts of the name and the role (same list as the BFF and the backend enum). */
export type ShareArtFont =
  | 'inter'
  | 'inter_bold'
  | 'serif'
  | 'serif_bold'
  | 'dancing_script'
  | 'great_vibes'
  | 'allura';

export type ShareArtAlign = 'left' | 'center' | 'right';

/**
 * REA-47: where the person's name (or role) goes, and how it looks. `size` is the font size as a
 * fraction of the image width (0.05 → 54px on 1080px); the text shrinks to fit its area.
 */
export interface ShareArtText extends ShareArtRect {
  font: ShareArtFont;
  size: number;
  color: string;
  align: ShareArtAlign;
}

export interface ShareArtProductRole {
  product_id: string;
  role: string;
}

export interface ShareArtFormatConfig {
  background: string;
  background_id: string;
  background_width?: number | null;
  background_height?: number | null;
  photo_area: ShareArtPhotoArea;
  /** REA-47: null → the name is not on the art. */
  name_text?: ShareArtText | null;
  /** REA-47: null → the role is not on the art. */
  role_text?: ShareArtText | null;
}

export interface ShareArtConfig {
  id?: string | null;
  story: ShareArtFormatConfig | null;
  feed: ShareArtFormatConfig | null;
  /** REA-47: role of whoever signed up with each product of the Eventando. */
  product_roles?: ShareArtProductRole[] | null;
  default_role?: string | null;
  /** REA-47: formats whose saved background is in an old ratio (the 1:1 feed): default art for now. */
  retired_formats?: string[] | null;
}

/** REA-47: the person's role, from the BFF (`myShareArtRole`). */
export type ShareArtRoleSource = 'ORGANIZER' | 'SPEAKER' | 'PRODUCT' | 'DEFAULT';

export interface ShareArtPersonRole {
  role: string;
  source: ShareArtRoleSource;
}

export const SHARE_ART_FORMAT_KEYS: ShareArtFormat[] = ['story', 'feed'];

/** How far (relative) a background may be from its format's ratio: 1080×1910 passes for 9:16, 1080×1900 does not. */
export const SHARE_ART_RATIO_TOLERANCE = 0.01;

/** Smallest side of the photo area, as a fraction of the image. */
export const SHARE_ART_MIN_AREA_SIDE = 0.05;

/** width / height of the background of a format (9:16 → 0.5625). */
export const imageRatioOf = (format: ShareArtFormat) =>
  SHARE_ART_FORMATS[format].aspect;

/** The format's config when it is complete (background and area); null → the default art. */
export function customFormatOf(
  config: ShareArtConfig | null | undefined,
  format: ShareArtFormat
): ShareArtFormatConfig | null {
  const value = config?.[format];
  return value?.background && value.photo_area ? value : null;
}

export function ratioMatches(
  width: number,
  height: number,
  ratio: number
): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  return Math.abs(width / height - ratio) / ratio <= SHARE_ART_RATIO_TOLERANCE;
}

/** Why an image cannot be the background of `format`, or null when it can (same rule as the BFF). */
export function backgroundProblem(
  format: ShareArtFormat,
  width: number,
  height: number
): string | null {
  const spec = SHARE_ART_FORMATS[format];
  const label = `${spec.label} (${spec.ratio})`;
  if (!ratioMatches(width, height, spec.aspect)) {
    return `O fundo do ${label} precisa ter proporção ${spec.ratio} (a enviada tem ${width}×${height}).`;
  }
  if (width < spec.width) {
    return `O fundo do ${label} precisa ter ao menos ${spec.width}×${spec.height} pixels (a enviada tem ${width}×${height}).`;
  }
  return null;
}

/**
 * Widest crop of a `width`×`height` image in the format's ratio, in pixels of the image (zoom 1 of
 * the crop dialog). An image in another ratio is cropped to the format before the upload.
 */
export function maxCropWidth(
  format: ShareArtFormat,
  width: number,
  height: number
): number {
  return Math.floor(Math.min(width, height * imageRatioOf(format)));
}

/** Why an image cannot be cropped into a background of `format` at all (too small), or null. */
export function cropSourceProblem(
  format: ShareArtFormat,
  width: number,
  height: number
): string | null {
  const spec = SHARE_ART_FORMATS[format];
  const widest = maxCropWidth(format, width, height);
  if (widest >= spec.width) return null;
  return `A imagem ${width}×${height} é pequena demais para o ${spec.label} (${spec.ratio}): cortada nessa proporção, fica com ${widest} px de largura, e o fundo precisa de ao menos ${spec.width} px.`;
}

/**
 * Why a crop `cropWidth` pixels wide (of the original image) cannot be the background, or null.
 * The crop is never enlarged: below the format's width it would be blurry.
 */
export function cropProblem(
  format: ShareArtFormat,
  cropWidth: number
): string | null {
  const spec = SHARE_ART_FORMATS[format];
  const width = Math.round(cropWidth);
  if (width >= spec.width) return null;
  return `O recorte tem ${width} px de largura; o fundo do ${spec.label} precisa de ao menos ${spec.width} px. Diminua o zoom.`;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** Rounds the rectangle (and the radius or the font size, when there is one) to 6 places. */
function rounded<T extends ShareArtRect>(area: T): T {
  const out: Record<string, unknown> = {
    ...(area as unknown as Record<string, unknown>),
    x: round(area.x),
    y: round(area.y),
    width: round(area.width),
    height: round(area.height),
  };
  if (typeof out.radius === 'number') out.radius = round(out.radius);
  if (typeof out.size === 'number') out.size = round(out.size);
  return out as unknown as T;
}

/** A centered circle covering 60% of the smaller side: where a new background starts. */
export function defaultPhotoArea(format: ShareArtFormat): ShareArtPhotoArea {
  return squareArea(
    { x: 0.2, y: 0.2, width: 0.6, height: 0.6, radius: 1 },
    imageRatioOf(format),
    0.6
  );
}

/**
 * Makes the area square in pixels, keeping its center. `side` (fraction of the image's smaller
 * dimension) defaults to the area's smaller side.
 */
export function squareArea(
  area: ShareArtPhotoArea,
  imageRatio: number,
  side?: number
): ShareArtPhotoArea {
  // Measured in units of the image height: the image is `imageRatio` wide and 1 tall.
  const pxWidth = area.width * imageRatio;
  const pxSide = Math.min(
    side !== undefined
      ? side * Math.min(imageRatio, 1)
      : Math.min(pxWidth, area.height),
    imageRatio,
    1
  );
  const width = pxSide / imageRatio;
  const height = pxSide;
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  return rounded({
    x: clamp(cx - width / 2, 0, 1 - width),
    y: clamp(cy - height / 2, 0, 1 - height),
    width,
    height,
    radius: area.radius,
  });
}

/** Is the area square in pixels (a radius of 1 then makes a circle)? */
export function isSquareArea(
  area: ShareArtPhotoArea,
  imageRatio: number
): boolean {
  return Math.abs(area.width * imageRatio - area.height) < 0.002;
}

/** width / height of the area in pixels: the ratio the participant's photo is cropped to. */
export function areaAspect(
  area: ShareArtPhotoArea,
  imageRatio: number
): number {
  return (area.width * imageRatio) / area.height;
}

/** Moves the area by (dx, dy) fractions, keeping it inside the image. */
export function moveArea<T extends ShareArtRect>(
  area: T,
  dx: number,
  dy: number
): T {
  return rounded({
    ...area,
    x: clamp(area.x + dx, 0, 1 - area.width),
    y: clamp(area.y + dy, 0, 1 - area.height),
  });
}

/** Which edges a resize handle moves: n, s, e, w and the corners. */
export type AreaHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const AREA_HANDLES: AreaHandle[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

/**
 * Resizes the area by dragging `handle` by (dx, dy) fractions. The opposite edge stays put, the
 * area stays inside the image and never gets smaller than SHARE_ART_MIN_AREA_SIDE. With `square`,
 * the area stays square in pixels (the dragged dimension decides the size).
 */
export function resizeArea<T extends ShareArtRect>(
  area: T,
  handle: AreaHandle,
  dx: number,
  dy: number,
  {
    imageRatio,
    square = false,
    minSide = SHARE_ART_MIN_AREA_SIDE,
  }: { imageRatio: number; square?: boolean; minSide?: number }
): T {
  const min = minSide;
  let left = area.x;
  let top = area.y;
  let right = area.x + area.width;
  let bottom = area.y + area.height;
  if (handle.includes('w')) left = clamp(left + dx, 0, right - min);
  if (handle.includes('e')) right = clamp(right + dx, left + min, 1);
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - min);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + min, 1);

  if (!square) {
    return rounded({
      ...area,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  }

  // Square in pixels: height = width × imageRatio (fractions of a W×H image, W/H = imageRatio).
  const horizontal = handle.includes('e') || handle.includes('w');
  let width = horizontal ? right - left : (bottom - top) / imageRatio;

  // Room left for the area from the edges that do not move.
  const cx = (area.x * 2 + area.width) / 2;
  const cy = (area.y * 2 + area.height) / 2;
  const maxWidth = handle.includes('w')
    ? right
    : handle.includes('e')
      ? 1 - left
      : 2 * Math.min(cx, 1 - cx);
  const maxHeight = handle.includes('n')
    ? bottom
    : handle.includes('s')
      ? 1 - top
      : 2 * Math.min(cy, 1 - cy);
  width = Math.min(width, maxWidth, maxHeight / imageRatio);
  width = Math.max(width, min, min / imageRatio);
  const height = width * imageRatio;

  const x = handle.includes('w')
    ? right - width
    : handle.includes('e')
      ? left
      : cx - width / 2;
  const y = handle.includes('n')
    ? bottom - height
    : handle.includes('s')
      ? top
      : cy - height / 2;
  return rounded({
    ...area,
    x: clamp(x, 0, 1 - width),
    y: clamp(y, 0, 1 - height),
    width,
    height,
  });
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
  /** corner radius in pixels */
  radius: number;
}

/** The area in pixels of a `width`×`height` drawing (the editor, the preview or the 1080px export). */
export function areaToPixels(
  area: ShareArtRect & { radius?: number },
  width: number,
  height: number
): PixelRect {
  const w = area.width * width;
  const h = area.height * height;
  return {
    left: area.x * width,
    top: area.y * height,
    width: w,
    height: h,
    radius: (clamp(area.radius ?? 0, 0, 1) * Math.min(w, h)) / 2,
  };
}

/** Source rectangle of `src` that covers a `dst` box (CSS object-fit: cover, centered). */
export function coverSource(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(dstWidth / srcWidth, dstHeight / srcHeight);
  const sw = dstWidth / scale;
  const sh = dstHeight / scale;
  return { sx: (srcWidth - sw) / 2, sy: (srcHeight - sh) / 2, sw, sh };
}

/**
 * GraphQL input of one format: the background media id, the photo area and (REA-47) the name and
 * role texts — null when off — or null for the whole format (default art).
 */
export function formatInput(
  value: {
    backgroundId: string | null;
    area: ShareArtPhotoArea;
    nameText?: ShareArtText | null;
    roleText?: ShareArtText | null;
  } | null
): {
  background: string;
  photo_area: ShareArtPhotoArea;
  name_text: ShareArtText | null;
  role_text: ShareArtText | null;
} | null {
  if (!value?.backgroundId) return null;
  // Only the fields of the input: a config read from Apollo carries __typename, which the BFF refuses.
  const { x, y, width, height, radius } = value.area;
  const text = (t: ShareArtText | null | undefined): ShareArtText | null =>
    t
      ? rounded({
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height,
          font: t.font,
          size: t.size,
          color: t.color,
          align: t.align,
        })
      : null;
  return {
    background: value.backgroundId,
    photo_area: rounded({ x, y, width, height, radius }),
    name_text: text(value.nameText),
    role_text: text(value.roleText),
  };
}

// ─── REA-47: name and role on the art ────────────────────────────────────────────────────

export const SHARE_ART_DEFAULT_ROLE = 'Participante';
export const SHARE_ART_ROLE_MAX = 40;
/** Font size, as a fraction of the image width. */
export const SHARE_ART_TEXT_SIZE_MIN = 0.01;
export const SHARE_ART_TEXT_SIZE_MAX = 0.2;
/** Smallest side of a text area (a line of text is thinner than a photo). */
export const SHARE_ART_MIN_TEXT_SIDE = 0.02;

export interface ShareArtFontSpec {
  key: ShareArtFont;
  label: string;
  /** CSS font-family; 'inter' is resolved at runtime (next/font gives it a hashed name). */
  family: 'inter' | string;
  weight: number;
}

/** The fonts of the art: the Hub's Inter, a system serif and the self-hosted cursive ones. */
export const SHARE_ART_FONTS: ShareArtFontSpec[] = [
  { key: 'inter', label: 'Inter', family: 'inter', weight: 400 },
  { key: 'inter_bold', label: 'Inter negrito', family: 'inter', weight: 800 },
  { key: 'serif', label: 'Serifada', family: 'Georgia, "Times New Roman", serif', weight: 400 },
  { key: 'serif_bold', label: 'Serifada negrito', family: 'Georgia, "Times New Roman", serif', weight: 700 },
  { key: 'dancing_script', label: 'Dancing Script (cursiva)', family: '"DancingScript", cursive', weight: 400 },
  { key: 'great_vibes', label: 'Great Vibes (cursiva)', family: '"GreatVibes", cursive', weight: 400 },
  { key: 'allura', label: 'Allura (cursiva)', family: '"Allura", cursive', weight: 400 },
];

export const fontSpecOf = (font: ShareArtFont): ShareArtFontSpec =>
  SHARE_ART_FONTS.find(spec => spec.key === font) ?? SHARE_ART_FONTS[1];

/**
 * Where the name and the role start on a new background: under the default photo circle, centered,
 * white bold name and a smaller role.
 */
export function defaultTextArea(
  format: ShareArtFormat,
  kind: 'name' | 'role'
): ShareArtText {
  const story = format === 'story';
  // Under the default circle: it ends at 0.67 of the height in 9:16 and at 0.74 in 4:5.
  const top = story ? 0.7 : 0.77;
  const name = { y: top, height: story ? 0.05 : 0.065, size: 0.06 };
  const role = {
    y: top + name.height + 0.01,
    height: story ? 0.035 : 0.045,
    size: 0.04,
  };
  const spec = kind === 'name' ? name : role;
  return {
    x: 0.1,
    y: spec.y,
    width: 0.8,
    height: spec.height,
    font: kind === 'name' ? 'inter_bold' : 'inter',
    size: spec.size,
    color: '#ffffff',
    align: 'center',
  };
}

/**
 * Font size in pixels so that the text fits its area: the configured size, capped by the area's
 * height and shrunk until `measure(px)` (the text width at px) fits the area's width.
 */
export function fitTextSize(
  measure: (px: number) => number,
  {
    size,
    areaWidth,
    areaHeight,
  }: { size: number; areaWidth: number; areaHeight: number }
): number {
  let px = Math.min(size, areaHeight / 1.15);
  const width = measure(px);
  if (width > areaWidth && width > 0) px = (px * areaWidth) / width;
  return Math.max(1, Math.floor(px * 100) / 100);
}

/** The role shown in the admin preview (no person yet): the event's default role. */
export function sampleRole(config: Pick<ShareArtConfig, 'default_role'> | null | undefined): string {
  return config?.default_role?.trim() || SHARE_ART_DEFAULT_ROLE;
}
