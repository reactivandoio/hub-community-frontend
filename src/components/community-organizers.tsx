'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { Organizer } from '@/lib/types';

/**
 * REA-54: the photo of a person is the avatar of their speaker profile (`speaker.avatar`, the one
 * edited in /profile/edit); the User itself has no avatar field in the BFF. `avatar` is kept for
 * older payloads.
 */
export function organizerAvatarUrl(organizer: Organizer): string | null {
  const url = organizer.speaker?.avatar || organizer.avatar;
  return url && url.trim() ? url : null;
}

export function organizerDisplayName(organizer: Organizer): string {
  return organizer.name?.trim() || organizer.speaker?.name?.trim() || organizer.username;
}

function OrganizerAvatar({ organizer }: { organizer: Organizer }) {
  const url = organizerAvatarUrl(organizer);
  const [failed, setFailed] = useState(false);
  const name = organizerDisplayName(organizer);

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="w-10 h-10 rounded-full object-cover shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function CommunityOrganizers({ organizers }: { organizers: Organizer[] }) {
  if (!organizers.length) return null;

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground mb-6">Organizadores</h2>
      <div className="flex flex-wrap gap-4">
        {organizers.map(organizer => (
          <Link
            key={organizer.id}
            href={`/users/${organizer.username}`}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <OrganizerAvatar organizer={organizer} />
            <div>
              <h4 className="font-semibold text-foreground text-sm">{organizerDisplayName(organizer)}</h4>
              <p className="text-xs text-muted-foreground">{organizer.role || 'Organizador'}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
