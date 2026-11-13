import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ShareArtAreaEditor } from '@/components/admin/share-art-area-editor';
import type { ShareArtPhotoArea } from '@/lib/share-art-config';

const START: ShareArtPhotoArea = { x: 0.2, y: 0.2, width: 0.4, height: 0.4, radius: 0.5 };

function Harness({ onChange, square = false }: { onChange: (a: ShareArtPhotoArea) => void; square?: boolean }) {
  const [area, setArea] = useState(START);
  return (
    <ShareArtAreaEditor
      backgroundUrl="blob:bg"
      imageRatio={1}
      area={area}
      square={square}
      photoUrl={null}
      onChange={next => {
        setArea(next);
        onChange(next);
      }}
    />
  );
}

const setup = (square = false) => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} square={square} />);
  const box = screen.getByTestId('share-art-area-editor');
  // jsdom has no layout: the editor is 400×400 px on screen.
  box.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return { onChange, box, area: screen.getByRole('group', { name: /Área da foto/ }) };
};

const drag = (target: Element, box: Element, from: [number, number], to: [number, number]) => {
  fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(box, { pointerId: 1, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(box, { pointerId: 1 });
};

describe('ShareArtAreaEditor', () => {
  it('moves the area by dragging it, in fractions of the image', () => {
    const { onChange, box, area } = setup();
    drag(area, box, [200, 200], [240, 180]); // +40px, -20px of 400px
    expect(onChange).toHaveBeenLastCalledWith({ ...START, x: 0.3, y: 0.15 });
  });

  it('resizes the area by dragging a corner handle', () => {
    const { onChange, box } = setup();
    const handle = box.querySelector('[data-handle="se"]')!;
    drag(handle, box, [240, 240], [280, 300]);
    expect(onChange).toHaveBeenLastCalledWith({ ...START, width: 0.5, height: 0.55 });
  });

  it('keeps it square when asked', () => {
    const { onChange, box } = setup(true);
    drag(box.querySelector('[data-handle="se"]')!, box, [240, 240], [280, 300]);
    const last = onChange.mock.calls.at(-1)![0] as ShareArtPhotoArea;
    expect(last.width).toBeCloseTo(last.height, 5);
  });

  it('stops following the pointer after it is released', () => {
    const { onChange, box, area } = setup();
    drag(area, box, [200, 200], [220, 200]);
    onChange.mockClear();
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 380, clientY: 380 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves with the arrow keys (Shift for bigger steps)', () => {
    const { onChange, area } = setup();
    fireEvent.keyDown(area, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith({ ...START, x: 0.21 });
    fireEvent.keyDown(area, { key: 'ArrowDown', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith({ ...START, x: 0.21, y: 0.25 });
  });
});

// ─── REA-47: name and role areas ────────────────────────────────────────────────────────
import type { ShareArtText } from '@/lib/share-art-config';

describe('ShareArtAreaEditor — text areas (REA-47)', () => {
  const NAME: ShareArtText = {
    x: 0.1, y: 0.7, width: 0.8, height: 0.1, font: 'inter_bold', size: 0.05, color: '#ffffff', align: 'center',
  };

  const renderTexts = (active: 'photo' | 'name' = 'photo') => {
    const onTextChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <ShareArtAreaEditor
        backgroundUrl="blob:bg"
        imageRatio={1}
        area={START}
        square={false}
        photoUrl={null}
        onChange={vi.fn()}
        texts={[{ key: 'name', label: 'Área do nome', style: NAME, preview: 'Maria Silva' }]}
        onTextChange={onTextChange}
        active={active}
        onSelect={onSelect}
      />
    );
    const box = screen.getByTestId('share-art-area-editor');
    box.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return { onTextChange, onSelect, box, name: screen.getByRole('group', { name: /Área do nome/ }) };
  };

  it('shows the name with its sample text and selects it when dragged', () => {
    const { onTextChange, onSelect, box, name } = renderTexts();
    expect(name).toHaveTextContent('Maria Silva');
    drag(name, box, [200, 300], [220, 280]); // +20px, -20px of 400px
    expect(onSelect).toHaveBeenCalledWith('name');
    expect(onTextChange).toHaveBeenLastCalledWith('name', { ...NAME, x: 0.15, y: 0.65 });
  });

  it('puts the handles on the selected area only', () => {
    const { box } = renderTexts('name');
    // 8 handles: the name's; the photo has none while the name is selected.
    expect(box.querySelectorAll('[data-handle]')).toHaveLength(8);
    const nameBox = screen.getByRole('group', { name: /Área do nome/ }).parentElement!;
    expect(nameBox.querySelectorAll('[data-handle]')).toHaveLength(8);
  });

  it('resizes a text area down to its own minimum, never square', () => {
    const { onTextChange, box } = renderTexts('name');
    const handle = screen.getByRole('group', { name: /Área do nome/ }).parentElement!.querySelector('[data-handle="s"]')!;
    drag(handle, box, [200, 320], [200, 200]);
    const last = onTextChange.mock.calls.at(-1)![1] as ShareArtText;
    expect(last.height).toBeCloseTo(0.02);
    expect(last.width).toBeCloseTo(0.8);
  });

  it('moves the focused text area with the arrow keys', () => {
    const { onTextChange, name } = renderTexts('name');
    fireEvent.keyDown(name, { key: 'ArrowUp', shiftKey: true });
    expect(onTextChange).toHaveBeenLastCalledWith('name', { ...NAME, y: 0.65 });
  });
});
