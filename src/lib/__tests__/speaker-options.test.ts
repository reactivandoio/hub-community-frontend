import { describe, expect, it, vi } from 'vitest';

import {
  fetchAllSpeakers,
  matchesSpeakerName,
  mergeSpeakers,
  SPEAKER_PAGE_SIZE,
} from '../speaker-options';
import type { Speaker } from '../types';

const speaker = (id: string, name = `Speaker ${id}`): Speaker => ({ id, name });

const pagedClient = (pages: Speaker[][], withMeta = true) => {
  const query = vi.fn(async ({ variables }: { variables: { pagination: { page: number } } }) => {
    const page = variables.pagination.page;
    return {
      data: {
        speakers: {
          data: pages[page - 1] ?? [],
          meta: withMeta
            ? { page, pageSize: SPEAKER_PAGE_SIZE, pageCount: pages.length, total: pages.flat().length }
            : null,
        },
      },
    };
  });
  return { query } as any;
};

const fullPage = (prefix: string) =>
  Array.from({ length: SPEAKER_PAGE_SIZE }, (_, i) => speaker(`${prefix}${i}`, `${prefix} ${String(i).padStart(3, '0')}`));

describe('fetchAllSpeakers', () => {
  it('loads every page reported by meta.pageCount, beyond the first one', async () => {
    const client = pagedClient([fullPage('a'), fullPage('b'), [speaker('z', 'Zélia Última')]]);
    const all = await fetchAllSpeakers(client);

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(all).toHaveLength(SPEAKER_PAGE_SIZE * 2 + 1);
    expect(all.map(s => s.name)).toContain('Zélia Última');
    const pages = client.query.mock.calls.map((c: any) => c[0].variables.pagination);
    expect(pages).toEqual([
      { page: 1, pageSize: SPEAKER_PAGE_SIZE },
      { page: 2, pageSize: SPEAKER_PAGE_SIZE },
      { page: 3, pageSize: SPEAKER_PAGE_SIZE },
    ]);
    expect(client.query.mock.calls[0][0].fetchPolicy).toBe('network-only');
  });

  it('without meta, keeps paging while pages come back full', async () => {
    const client = pagedClient([fullPage('a'), [speaker('z')]], false);
    const all = await fetchAllSpeakers(client);

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(all).toHaveLength(SPEAKER_PAGE_SIZE + 1);
  });

  it('makes a single call when everything fits in one page', async () => {
    const client = pagedClient([[speaker('1', 'Ana')]]);
    expect(await fetchAllSpeakers(client)).toEqual([speaker('1', 'Ana')]);
    expect(client.query).toHaveBeenCalledTimes(1);
  });
});

describe('matchesSpeakerName', () => {
  it('matches part of the name ignoring case and accents', () => {
    expect(matchesSpeakerName('Zélia Última', 'zelia ult')).toBe(true);
    expect(matchesSpeakerName('João', 'JOAO')).toBe(true);
    expect(matchesSpeakerName('Ana', 'Bruno')).toBe(false);
    expect(matchesSpeakerName(undefined, 'a')).toBe(false);
  });
});

describe('mergeSpeakers', () => {
  it('unions by id, the first list wins, sorted by name ignoring case and accents', () => {
    const merged = mergeSpeakers(
      [speaker('1', 'bruno'), speaker('2', 'Álvaro (servidor)')],
      [speaker('2', 'Álvaro (local)'), speaker('3', 'Carla')],
    );
    expect(merged.map(s => s.name)).toEqual(['Álvaro (servidor)', 'bruno', 'Carla']);
  });
});
