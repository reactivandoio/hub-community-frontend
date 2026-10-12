'use client';

import React, { useEffect, useRef, useState } from 'react';

import { MarkdownContent } from '@/components/ui/markdown-content';
import type { RichTextValue } from '@/lib/rich-text';
import { cn } from '@/lib/utils';

interface ExpandableRichTextProps {
  content: RichTextValue;
  className?: string;
  maxLines?: number;
}

/**
 * Markdown description collapsed to about `maxLines` lines, with a fade and a
 * "Ver mais" button when it overflows.
 */
export const ExpandableRichText: React.FC<ExpandableRichTextProps> = ({
  content,
  className,
  maxLines = 12,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [content, expanded]);

  const collapsed = !expanded && overflows;

  return (
    <div>
      <div
        ref={contentRef}
        className={cn(
          !expanded && 'overflow-hidden',
          collapsed &&
            '[mask-image:linear-gradient(to_bottom,black_85%,transparent)]'
        )}
        // Line height of the prose body is ~1.75em.
        style={expanded ? undefined : { maxHeight: `${maxLines * 1.75}em` }}
      >
        <MarkdownContent content={content} className={className} />
      </div>
      {(overflows || expanded) && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            aria-expanded={expanded}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors px-4 py-1.5 rounded-full bg-primary/5 hover:bg-primary/10"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Ver menos' : 'Ver mais'}
          </button>
        </div>
      )}
    </div>
  );
};
