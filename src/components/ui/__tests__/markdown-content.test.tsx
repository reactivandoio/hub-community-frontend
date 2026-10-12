import type { BlocksContent } from '@strapi/blocks-react-renderer';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MarkdownContent } from '../markdown-content';

const editorBlocks = (markdown: string) =>
  markdown.split('\n\n').map(p => ({
    type: 'paragraph',
    children: [{ type: 'text', text: p }],
  })) as BlocksContent;

describe('MarkdownContent', () => {
  it('renders the event description from the report without markdown symbols', () => {
    const { container } = render(
      <MarkdownContent
        content={editorBlocks(
          [
            '# 🚀 Meetup Reactivando Anápolis — Tecnologia, IA e Soberania Digital',
            '## 🎤 Palestras',
            '### 🤖 Engenharia no Piloto Automático!',
            '**Palestrante: Pedro Goiânia**',
          ].join('\n\n')
        )}
      />
    );

    // Author headings sit below the page's h1/h2.
    expect(
      screen.getByRole('heading', { level: 3, name: /Meetup Reactivando Anápolis/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: /Palestras/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 5, name: /Piloto Automático/ })
    ).toBeInTheDocument();
    expect(screen.getByText('Palestrante: Pedro Goiânia').tagName).toBe('STRONG');
    expect(container.textContent).not.toMatch(/[#*]/);
  });

  it('renders italic, lists, links, quotes, code and line breaks', () => {
    const { container } = render(
      <MarkdownContent
        content={[
          'Texto _itálico_ e `pnpm dev`',
          'linha 1\nlinha 2',
          '- item a\n- item b',
          '1. primeiro\n2. segundo',
          '> uma citação',
          '[Inscreva-se](https://hubcommunity.io) ou [agenda](/events)',
          '```\nconst a = 1;\n```',
        ].join('\n\n')}
      />
    );

    expect(screen.getByText('itálico').tagName).toBe('EM');
    expect(screen.getByText('pnpm dev').tagName).toBe('CODE');
    expect(container.querySelector('br')).not.toBeNull();
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
    expect(container.querySelector('blockquote')).toHaveTextContent('uma citação');
    expect(container.querySelector('pre code')).toHaveTextContent('const a = 1;');

    const external = screen.getByRole('link', { name: 'Inscreva-se' });
    expect(external).toHaveAttribute('href', 'https://hubcommunity.io');
    expect(external).toHaveAttribute('target', '_blank');
    expect(external.getAttribute('rel')).toContain('noopener');
    expect(external.getAttribute('rel')).toContain('noreferrer');

    const internal = screen.getByRole('link', { name: 'agenda' });
    expect(internal).toHaveAttribute('href', '/events');
    expect(internal).not.toHaveAttribute('target');
  });

  it('does not render raw HTML, scripts or javascript: links', () => {
    const { container } = render(
      <MarkdownContent
        content={[
          '<script>window.__pwned = true</script>',
          '<img src="x" onerror="window.__pwned = true">',
          'Oi <b onclick="alert(1)">negrito</b>',
          '<iframe src="https://evil.example"></iframe>',
          '[clique](javascript:alert(1))',
        ].join('\n\n')}
      />
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('[onclick],[onerror]')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();

    const link = screen.getByText('clique').closest('a');
    expect(link?.getAttribute('href') ?? '').not.toMatch(/javascript:/i);
  });

  it('renders an old plain-text description as paragraphs', () => {
    const { container } = render(
      <MarkdownContent content={'Primeiro parágrafo.\nCom quebra.\n\nSegundo parágrafo.'} />
    );
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelector('br')).not.toBeNull();
  });

  it('renders legacy Strapi blocks with formatting flags', () => {
    render(
      <MarkdownContent
        content={
          [
            { type: 'heading', level: 2, children: [{ type: 'text', text: 'Agenda' }] },
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Chegue ' },
                { type: 'text', text: 'cedo', bold: true },
              ],
            },
            {
              type: 'list',
              format: 'unordered',
              children: [{ type: 'list-item', children: [{ type: 'text', text: 'café' }] }],
            },
          ] as unknown as BlocksContent
        }
      />
    );
    expect(screen.getByRole('heading', { level: 4, name: 'Agenda' })).toBeInTheDocument();
    expect(screen.getByText('cedo').tagName).toBe('STRONG');
    expect(screen.getByRole('listitem')).toHaveTextContent('café');
  });

  it('renders nothing for empty content', () => {
    const { container } = render(<MarkdownContent content={editorBlocks('')} />);
    expect(container).toBeEmptyDOMElement();
  });
});
