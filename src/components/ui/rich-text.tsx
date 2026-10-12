import * as React from 'react';

import { MarkdownContent } from '@/components/ui/markdown-content';
import type { RichTextValue } from '@/lib/rich-text';

interface RichTextProps {
  content: RichTextValue;
  className?: string;
}

export const RichText: React.FC<RichTextProps> = ({ content, className }) => (
  <MarkdownContent content={content} className={className} />
);
