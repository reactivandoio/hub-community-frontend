import type { ApolloClient } from '@apollo/client';

import { GET_SPEAKER_OPTIONS } from './queries';
import type { Speaker } from './types';

// Strapi caps a page at 100 (config/api.ts maxLimit); the BFF default is 25.
export const SPEAKER_PAGE_SIZE = 100;
// Safety net against a misbehaving meta: 50 pages = 5000 speakers.
const MAX_PAGES = 50;

export interface SpeakerOptionsResponse {
  speakers: {
    data: Speaker[];
    meta?: { total?: number; page?: number; pageSize?: number; pageCount?: number } | null;
  } | null;
}

// The BFF `search` argument filters on title/description, which speakers do not
// have, so the picker loads every page and searches in the browser.
export async function fetchAllSpeakers(
  client: Pick<ApolloClient<unknown>, 'query'>,
): Promise<Speaker[]> {
  const loadPage = async (page: number) => {
    const { data } = await client.query<SpeakerOptionsResponse>({
      query: GET_SPEAKER_OPTIONS,
      variables: {
        sort: [{ name: 'ASC' }, { id: 'ASC' }],
        pagination: { page, pageSize: SPEAKER_PAGE_SIZE },
      },
      fetchPolicy: 'network-only',
    });
    return data?.speakers ?? null;
  };

  const first = await loadPage(1);
  const speakers = [...(first?.data ?? [])];
  const pageCount = first?.meta?.pageCount;

  if (pageCount) {
    const rest = await Promise.all(
      Array.from({ length: Math.min(pageCount, MAX_PAGES) - 1 }, (_, i) => loadPage(i + 2)),
    );
    rest.forEach(result => speakers.push(...(result?.data ?? [])));
  } else {
    // No meta: keep going while pages come back full.
    let page = 1;
    let last = first?.data?.length ?? 0;
    while (last === SPEAKER_PAGE_SIZE && page < MAX_PAGES) {
      page += 1;
      const result = await loadPage(page);
      last = result?.data?.length ?? 0;
      speakers.push(...(result?.data ?? []));
    }
  }

  return mergeSpeakers(speakers, []);
}

// Union by id (the first list wins), sorted by name. Keeps speakers known only
// locally — the ones already on the talk or just created — next to the loaded list.
export function mergeSpeakers(primary: Speaker[], secondary: Speaker[]): Speaker[] {
  const byId = new Map<string, Speaker>();
  [...primary, ...secondary].forEach(speaker => {
    if (speaker?.id && !byId.has(speaker.id)) byId.set(speaker.id, speaker);
  });
  return [...byId.values()].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR', { sensitivity: 'base' }),
  );
}
