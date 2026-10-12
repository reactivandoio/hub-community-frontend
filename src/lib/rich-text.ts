import type { BlocksContent } from '@strapi/blocks-react-renderer';

import type { CommentData } from '@/lib/types';

/**
 * Rich text as the BFF stores it: a markdown string, or Strapi blocks.
 *
 * The admin editor (`RichTextEditor`) saves markdown split into one
 * `paragraph` block per "\n\n", each with a single plain text node — so the
 * markdown lives inside the blocks. Older records may hold real Strapi blocks
 * (headings, lists, bold flags…) or a plain string. Everything is turned into
 * one markdown string and rendered by `MarkdownContent`, so every place that
 * shows a description behaves the same.
 */
export type RichTextValue =
  | string
  | BlocksContent
  | CommentData[]
  | null
  | undefined;

interface BlockNode {
  type?: string;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  url?: string;
  level?: number;
  format?: 'ordered' | 'unordered';
  language?: string;
  image?: { url?: string; alternativeText?: string | null };
  children?: BlockNode[];
}

function inline(nodes: BlockNode[] | undefined): string {
  return (nodes ?? [])
    .map(node => {
      if (node.type === 'link') {
        const label = inline(node.children);
        return node.url ? `[${label || node.url}](${node.url})` : label;
      }
      if (node.type !== 'text' && node.children) return inline(node.children);

      let text = node.text ?? '';
      // Formatting flags only exist on legacy Strapi blocks; the editor writes
      // the markdown markers into the text itself.
      if (!text.trim()) return text;
      if (node.code) text = `\`${text}\``;
      if (node.bold) text = `**${text}**`;
      if (node.italic) text = `_${text}_`;
      if (node.strikethrough) text = `~~${text}~~`;
      return text;
    })
    .join('');
}

function list(node: BlockNode, depth: number): string {
  const indent = '   '.repeat(depth);
  return (node.children ?? [])
    .map((item, i) => {
      if (item.type === 'list') return list(item, depth + 1);
      const marker = node.format === 'ordered' ? `${i + 1}.` : '-';
      const nested = (item.children ?? []).filter(c => c.type === 'list');
      const text = inline((item.children ?? []).filter(c => c.type !== 'list'));
      return [
        `${indent}${marker} ${text}`,
        ...nested.map(n => list(n, depth + 1)),
      ].join('\n');
    })
    .join('\n');
}

function block(node: BlockNode): string {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(node.level ?? 2, 1), 6);
      return `${'#'.repeat(level)} ${inline(node.children)}`;
    }
    case 'list':
      return list(node, 0);
    case 'quote':
      return inline(node.children)
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
    case 'code':
      return `\`\`\`${node.language ?? ''}\n${inline(node.children)}\n\`\`\``;
    case 'image':
      return node.image?.url
        ? `![${node.image.alternativeText ?? ''}](${node.image.url})`
        : '';
    default:
      return inline(node.children);
  }
}

/** Turns a stored description (markdown string or Strapi blocks) into markdown. */
export function richTextToMarkdown(content: RichTextValue): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return (content as BlockNode[])
    .map(block)
    .join('\n\n')
    .trim();
}
