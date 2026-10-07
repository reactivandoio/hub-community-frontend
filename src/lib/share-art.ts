/**
 * "Me inscrevi" share art — pure helpers (no DOM).
 * The art is rendered by `components/share-art/share-art-template.tsx` and exported in the browser
 * by `lib/share-art-image.ts`; nothing is uploaded.
 */

export const SHARE_ART_ROLES = [
  'Participante',
  'Líder',
  'Mentor',
  'Voluntário',
  'Palestrante',
  'Organizador',
] as const;

export type ShareArtRole = (typeof SHARE_ART_ROLES)[number];

export type ShareArtFormat = 'story' | 'feed';

export const SHARE_ART_FORMATS: Record<
  ShareArtFormat,
  {
    label: string;
    ratio: string;
    aspect: number;
    width: number;
    height: number;
  }
> = {
  story: {
    label: 'Stories',
    ratio: '9:16',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
  },
  feed: { label: 'Feed', ratio: '1:1', aspect: 1, width: 1080, height: 1080 },
};

/**
 * The template is laid out in fixed CSS pixels at `width` and exported at 1080px wide, so text and
 * spacing keep their proportions on every screen. `photo` is the photo frame, whose ratio drives
 * the cropper.
 */
export const SHARE_ART_LAYOUT: Record<
  ShareArtFormat,
  { width: number; height: number; photo: { width: number; height: number } }
> = {
  story: { width: 360, height: 640, photo: { width: 328, height: 416 } },
  feed: { width: 360, height: 360, photo: { width: 176, height: 264 } },
};

export type ShareArtFilter = 'natural' | 'destaque' | 'pb';

/** Burned into the photo pixels on a canvas (Safari drops CSS filters when html-to-image copies the DOM). */
export const SHARE_ART_FILTERS: Record<
  ShareArtFilter,
  { label: string; css: string }
> = {
  natural: { label: 'Natural', css: 'none' },
  destaque: { label: 'Destaque', css: 'grayscale(20%) contrast(125%)' },
  pb: { label: 'P&B', css: 'grayscale(100%) contrast(115%)' },
};

export const SHARE_ART_NAME_MAX = 25;

/** Largest side of the user photo kept in memory; enough for a 1080px export and light for html-to-image. */
export const SHARE_ART_PHOTO_MAX = 1500;

export interface ShareArtEventInput {
  slug?: string | null;
  title?: string | null;
  start_date?: string | null;
  images?: (string | null)[] | null;
  location?: { title?: string | null; city?: string | null } | null;
  is_online?: boolean | null;
  communities?: { title?: string | null }[] | null;
}

export interface ShareArtEventData {
  title: string;
  dateLabel: string;
  placeLabel: string;
  communityLabel: string;
  coverUrl: string | null;
  link: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatShareArtDate(startDate?: string | null): string {
  if (!startDate) return '';
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return '';
  // "07 de out. de 2026" → "07 OUT 2026"
  const parts = DATE_FORMAT.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month').replace('.', '')} ${get('year')}`.toUpperCase();
}

export function buildShareArtEvent(
  event: ShareArtEventInput,
  siteHost = 'hubcommunity.io'
): ShareArtEventData {
  const place = event.is_online
    ? 'Online'
    : event.location?.city || event.location?.title || '';
  const community = (event.communities ?? [])
    .map(c => c?.title?.trim())
    .filter(Boolean)
    .join(' · ');

  return {
    title: event.title?.trim() || 'Evento',
    dateLabel: formatShareArtDate(event.start_date),
    placeLabel: place,
    communityLabel: community,
    coverUrl: event.images?.find(Boolean) ?? null,
    link: event.slug ? `${siteHost}/events/${event.slug}` : siteHost,
  };
}

export function cleanShareArtName(name: string): string {
  return name.replace(/\s+/g, ' ').trimStart().slice(0, SHARE_ART_NAME_MAX);
}

function slugPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function shareArtFileName(
  eventSlug: string,
  role: string,
  format: ShareArtFormat
): string {
  const event = slugPart(eventSlug) || 'evento';
  return `${event}-${slugPart(role) || 'participante'}-${SHARE_ART_FORMATS[format].ratio.replace(':', 'x')}.png`;
}

/** Scale (w, h) down so the larger side is at most `max`, keeping the ratio. */
export function fitWithin(
  width: number,
  height: number,
  max: number
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  if (width >= height)
    return { width: max, height: Math.round((height * max) / width) };
  return { width: Math.round((width * max) / height), height: max };
}

/**
 * Same-origin URL for a CMS image, so the canvas/html-to-image can read its pixels
 * (manager.hubcommunity.io does not send CORS headers). Relative and data URLs pass through.
 */
export function sameOriginImageUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/og-image?url=${encodeURIComponent(url)}`;
}
