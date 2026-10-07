import { CalendarDays, MapPin, UserRound } from 'lucide-react';
import { forwardRef } from 'react';

import {
  SHARE_ART_LAYOUT,
  type ShareArtEventData,
  type ShareArtFormat,
} from '@/lib/share-art';
import { cn } from '@/lib/utils';

/**
 * Fixed colors on purpose: the PNG must look the same in light and dark theme.
 * Hub palette — emerald #10B981 / purple #8B5CF6 on a deep navy.
 */
const ROLE_BADGE: Record<string, string> = {
  Participante: 'bg-emerald-500 text-white',
  Líder: 'bg-amber-400 text-slate-950',
  Mentor: 'bg-violet-500 text-white',
  Voluntário: 'bg-pink-500 text-white',
  Palestrante: 'bg-sky-500 text-white',
  Organizador: 'bg-white text-slate-950',
};

export interface ShareArtTemplateProps {
  format: ShareArtFormat;
  event: ShareArtEventData;
  role: string;
  name: string;
  /** data URL of the cropped, filtered photo */
  photoUrl: string | null;
  /** data URL of the event cover (null → no thumbnail) */
  coverUrl: string | null;
  /** data URL of the Hub logo */
  logoUrl: string | null;
}

function PhotoFrame({
  photoUrl,
  role,
  name,
  width,
  height,
  compact,
}: {
  photoUrl: string | null;
  role: string;
  name: string;
  width: number;
  height: number;
  compact: boolean;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-2xl bg-slate-800 ring-2 ring-emerald-400/70"
      style={{ width, height }}
    >
      {photoUrl ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${photoUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          role="img"
          aria-label="Sua foto"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
          <UserRound className="h-12 w-12" strokeWidth={1.5} />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Sua foto
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" />
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col items-start',
          compact ? 'gap-1.5 p-3' : 'gap-2 p-4'
        )}
      >
        <span
          className={cn(
            'rounded-full font-bold uppercase tracking-wide',
            compact ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
            ROLE_BADGE[role] ?? ROLE_BADGE.Participante
          )}
        >
          {role}
        </span>
        {name.trim() && (
          <span
            className={cn(
              'font-extrabold uppercase leading-tight text-white break-words w-full',
              compact ? 'text-base' : 'text-2xl'
            )}
          >
            {name.trim()}
          </span>
        )}
      </div>
    </div>
  );
}

function EventInfo({
  event,
  coverUrl,
  compact,
}: {
  event: ShareArtEventData;
  coverUrl: string | null;
  compact: boolean;
}) {
  const details = (
    <div className={cn('flex min-w-0 flex-col', compact ? 'gap-1' : 'gap-0.5')}>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
        Me inscrevi no
      </span>
      <span
        className={cn(
          'font-extrabold leading-tight text-white',
          compact ? 'text-base line-clamp-4' : 'text-lg line-clamp-2'
        )}
      >
        {event.title}
      </span>
      {(event.dateLabel || event.placeLabel) && (
        <span
          className={cn(
            'flex text-[11px] font-medium text-slate-300',
            compact ? 'flex-col gap-1' : 'items-center gap-3'
          )}
        >
          {event.dateLabel && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-violet-300" />
              {event.dateLabel}
            </span>
          )}
          {event.placeLabel && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-violet-300" />
              {event.placeLabel}
            </span>
          )}
        </span>
      )}
      {event.communityLabel && (
        <span className="truncate text-[10px] font-medium text-slate-400">
          {event.communityLabel}
        </span>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- data URL captured by html-to-image
          <img
            src={coverUrl}
            alt=""
            className="h-[72px] w-full rounded-xl object-cover"
          />
        )}
        {details}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- data URL captured by html-to-image
        <img
          src={coverUrl}
          alt=""
          className="h-20 w-20 shrink-0 rounded-xl object-cover"
        />
      )}
      {details}
    </div>
  );
}

/** The "me inscrevi" art. Rendered at fixed CSS pixels; the generator scales the preview and the export. */
export const ShareArtTemplate = forwardRef<
  HTMLDivElement,
  ShareArtTemplateProps
>(function ShareArtTemplate(
  { format, event, role, name, photoUrl, coverUrl, logoUrl },
  ref
) {
  const layout = SHARE_ART_LAYOUT[format];
  const isStory = format === 'story';

  // Brand glow as gradients, not blur(): Safari drops CSS filters inside html-to-image's SVG.
  return (
    <div
      ref={ref}
      className="relative flex shrink-0 flex-col overflow-hidden bg-[#0B1220] bg-[radial-gradient(circle_at_0%_0%,rgba(16,185,129,0.28),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(139,92,246,0.32),transparent_50%)] p-4 font-sans"
      style={{ width: layout.width, height: layout.height }}
    >
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-between',
          isStory ? 'h-8' : 'h-7'
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL captured by html-to-image
          <img
            src={logoUrl}
            alt="Hub Community"
            className={cn('w-auto', isStory ? 'h-6' : 'h-5')}
          />
        ) : (
          <span className="text-sm font-extrabold text-white">
            Hub Community
          </span>
        )}
        <span className="rounded-full bg-gradient-to-r from-emerald-500 to-violet-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          Eu vou!
        </span>
      </div>

      {isStory ? (
        <div className="relative mt-3 flex flex-1 flex-col gap-3">
          <PhotoFrame
            photoUrl={photoUrl}
            role={role}
            name={name}
            width={layout.photo.width}
            height={layout.photo.height}
            compact={false}
          />
          <EventInfo event={event} coverUrl={coverUrl} compact={false} />
        </div>
      ) : (
        <div className="relative mt-2.5 flex flex-1 gap-3">
          <PhotoFrame
            photoUrl={photoUrl}
            role={role}
            name={name}
            width={layout.photo.width}
            height={layout.photo.height}
            compact
          />
          <EventInfo event={event} coverUrl={coverUrl} compact />
        </div>
      )}

      <div className="relative flex shrink-0 items-center justify-center pt-2">
        <span className="text-[10px] font-semibold tracking-wide text-slate-400">
          {event.link}
        </span>
      </div>
    </div>
  );
});
