'use client';

import { Button } from '@/components/ui/button';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { Textarea } from '@/components/ui/textarea';
import { CommentData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

interface RichTextEditorProps {
  value: CommentData[];
  onChange: (value: CommentData[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva seu comentário...',
  className,
  disabled = false,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const [textValue, setTextValue] = useState(() => {
    // Convert CommentData[] to plain text for editing
    return value
      .map(block => block.children.map(child => child.text || '').join(''))
      .join('\n\n');
  });

  // Sync textValue when value prop changes (e.g., when form is reset)
  useEffect(() => {
    const newTextValue = value
      .map(block => block.children.map(child => child.text || '').join(''))
      .join('\n\n');
    setTextValue(newTextValue);
  }, [value]);

  const handleTextChange = useCallback(
    (text: string) => {
      setTextValue(text);

      // Convert plain text to CommentData[] format
      // Always create at least one paragraph, even for empty text
      const paragraphs = text === '' ? [''] : text.split('\n\n');
      const commentData: CommentData[] = paragraphs.map(paragraph => ({
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: paragraph,
          },
        ],
      }));

      onChange(commentData);
    },
    [onChange]
  );

  const insertFormatting = useCallback(
    (type: 'bold' | 'italic' | 'code') => {
      // Markdown markers; the public pages render them with MarkdownContent.
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textValue.substring(start, end);

      let replacement = '';
      switch (type) {
        case 'bold':
          replacement = `**${selectedText}**`;
          break;
        case 'italic':
          replacement = `*${selectedText}*`;
          break;
        case 'code':
          replacement = `\`${selectedText}\``;
          break;
      }

      const newText =
        textValue.substring(0, start) + replacement + textValue.substring(end);
      setTextValue(newText);
      handleTextChange(newText);

      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + replacement.length,
          start + replacement.length
        );
      }, 0);
    },
    [textValue, handleTextChange]
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* Formatting Toolbar */}
      <div className="flex gap-1 p-2 bg-muted/50 rounded-t-lg border border-b-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertFormatting('bold')}
          disabled={disabled || previewing}
          className="h-8 px-2"
        >
          <strong>B</strong>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertFormatting('italic')}
          disabled={disabled || previewing}
          className="h-8 px-2"
        >
          <em>I</em>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertFormatting('code')}
          disabled={disabled || previewing}
          className="h-8 px-2 font-mono"
        >
          {'</>'}
        </Button>
        <Button
          type="button"
          variant={previewing ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setPreviewing(p => !p)}
          aria-pressed={previewing}
          className="h-8 px-2 ml-auto"
        >
          {previewing ? 'Editar' : 'Pré-visualizar'}
        </Button>
      </div>

      {/* Preview uses the same renderer as the public pages */}
      {previewing ? (
        <div className="min-h-[120px] rounded-md rounded-t-none border bg-background px-3 py-2">
          {textValue.trim() ? (
            <MarkdownContent content={textValue} />
          ) : (
            <p className="text-sm text-muted-foreground">Nada para mostrar.</p>
          )}
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={textValue}
          onChange={e => handleTextChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[120px] resize-y rounded-t-none"
          rows={4}
        />
      )}

      {/* Character Count */}
      <div className="text-xs text-gray-500 text-right">
        {textValue.length} caracteres
      </div>
    </div>
  );
}
