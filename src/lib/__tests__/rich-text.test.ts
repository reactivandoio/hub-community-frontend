import type { BlocksContent } from '@strapi/blocks-react-renderer';
import { describe, expect, it } from 'vitest';

import { richTextToMarkdown } from '../rich-text';

describe('richTextToMarkdown', () => {
  it('returns empty for missing content', () => {
    expect(richTextToMarkdown(null)).toBe('');
    expect(richTextToMarkdown(undefined)).toBe('');
    expect(richTextToMarkdown([] as unknown as BlocksContent)).toBe('');
  });

  it('keeps a markdown string as is', () => {
    expect(richTextToMarkdown('# Título\n\n**negrito**')).toBe(
      '# Título\n\n**negrito**'
    );
  });

  it('joins the editor paragraphs back into the markdown that was typed', () => {
    const typed = '# 🚀 Meetup\n\n## 🎤 Palestras\n\n**Palestrante: Pedro**\nlinha 2';
    const blocks = typed.split('\n\n').map(p => ({
      type: 'paragraph',
      children: [{ type: 'text', text: p }],
    })) as BlocksContent;
    expect(richTextToMarkdown(blocks)).toBe(typed);
  });

  it('converts legacy Strapi blocks', () => {
    const blocks = [
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Agenda' }] },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Venha ' },
          { type: 'text', text: 'cedo', bold: true },
          { type: 'text', text: ' e ' },
          { type: 'text', text: 'leve', italic: true },
          { type: 'text', text: ' ' },
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: 'site' }],
          },
        ],
      },
      {
        type: 'list',
        format: 'ordered',
        children: [
          { type: 'list-item', children: [{ type: 'text', text: 'um' }] },
          { type: 'list-item', children: [{ type: 'text', text: 'dois' }] },
        ],
      },
      { type: 'quote', children: [{ type: 'text', text: 'citação' }] },
      { type: 'code', children: [{ type: 'text', text: 'pnpm dev' }] },
    ] as unknown as BlocksContent;

    expect(richTextToMarkdown(blocks)).toBe(
      [
        '## Agenda',
        'Venha **cedo** e _leve_ [site](https://example.com)',
        '1. um\n2. dois',
        '> citação',
        '```\npnpm dev\n```',
      ].join('\n\n')
    );
  });
});
