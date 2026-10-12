import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CommentData } from '@/lib/types';

import { RichTextEditor } from '../rich-text-editor';

const value: CommentData[] = [
  { type: 'paragraph', children: [{ type: 'text', text: '## Palestras' }] },
  { type: 'paragraph', children: [{ type: 'text', text: '**Pedro**' }] },
];

describe('RichTextEditor preview', () => {
  it('shows the same rendering as the public page', () => {
    render(<RichTextEditor value={value} onChange={vi.fn()} />);

    expect(screen.getByRole('textbox')).toHaveValue('## Palestras\n\n**Pedro**');

    fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Palestras' })).toBeInTheDocument();
    expect(screen.getByText('Pedro').tagName).toBe('STRONG');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('textbox')).toHaveValue('## Palestras\n\n**Pedro**');
  });

  it('wraps the selection of its own textarea when formatting', () => {
    const onChange = vi.fn();
    render(
      <>
        <textarea aria-label="outro campo" defaultValue="" />
        <RichTextEditor
          value={[{ type: 'paragraph', children: [{ type: 'text', text: 'oi' }] }]}
          onChange={onChange}
        />
      </>
    );
    const textarea = screen.getAllByRole('textbox')[1] as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 2);
    fireEvent.click(screen.getByRole('button', { name: 'B' }));

    expect(onChange).toHaveBeenLastCalledWith([
      { type: 'paragraph', children: [{ type: 'text', text: '**oi**' }] },
    ]);
  });
});
