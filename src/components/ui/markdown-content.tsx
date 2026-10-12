import * as React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { richTextToMarkdown, type RichTextValue } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: RichTextValue;
  className?: string;
}

type HeadingTag = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

// The page already owns <h1> (title) and <h2> (section), so the author's
// headings start one level below the section heading.
const HEADING_CLASSES: Record<number, string> = {
  1: 'text-xl sm:text-2xl font-bold tracking-tight mt-8 mb-4',
  2: 'text-lg sm:text-xl font-semibold tracking-tight mt-8 mb-3 pb-2 border-b border-border/60',
  3: 'text-base sm:text-lg font-semibold mt-6 mb-2',
  4: 'text-base font-semibold mt-5 mb-2',
  5: 'text-sm font-semibold uppercase tracking-wide mt-4 mb-2',
  6: 'text-sm font-semibold mt-4 mb-2',
};

function heading(level: number): Components['h1'] {
  const Tag = `h${Math.min(level + 2, 6)}` as HeadingTag;
  const Heading: Components['h1'] = ({ node: _node, className, ...props }) => (
    <Tag
      className={cn(
        'text-foreground scroll-mt-24 first:mt-0',
        HEADING_CLASSES[level],
        className
      )}
      {...props}
    />
  );
  Heading.displayName = `MarkdownH${level}`;
  return Heading;
}

const isExternal = (href?: string) => !!href && /^(https?:)?\/\//i.test(href);

const components: Components = {
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  h5: heading(5),
  h6: heading(6),
  a: ({ node: _node, href, ...props }) =>
    isExternal(href) ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        {...props}
      />
    ) : (
      <a href={href} {...props} />
    ),
  img: ({ node: _node, alt, ...props }) => (
    // Author-provided images with unknown size; next/image needs dimensions.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt ?? ''}
      loading="lazy"
      className="rounded-xl border border-border/40"
      {...props}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
};

/**
 * Renders user-written rich text (markdown string or Strapi blocks) safely:
 * raw HTML is dropped (`skipHtml`) and react-markdown strips unsafe URLs such
 * as `javascript:`. Used by every description on the site and by the admin
 * editor preview, so both show the same thing.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const markdown = richTextToMarkdown(content);
  if (!markdown.trim()) return null;

  return (
    <div
      className={cn(
        'prose prose-sm sm:prose-base dark:prose-invert max-w-none break-words',
        'prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-3',
        'prose-li:text-muted-foreground prose-li:my-1 prose-li:marker:text-primary',
        'prose-ul:my-3 prose-ol:my-3',
        'prose-strong:text-foreground prose-strong:font-semibold',
        'prose-em:text-foreground/90',
        'prose-a:text-primary prose-a:font-medium prose-a:underline-offset-4 prose-a:decoration-primary/40 hover:prose-a:decoration-primary',
        'prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:not-italic prose-blockquote:text-muted-foreground',
        'prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:text-foreground prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal',
        'prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border/50 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        'prose-hr:border-border/60',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
        skipHtml
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
