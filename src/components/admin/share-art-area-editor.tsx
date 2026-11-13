'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import {
  AREA_HANDLES,
  SHARE_ART_MIN_AREA_SIDE,
  SHARE_ART_MIN_TEXT_SIDE,
  areaToPixels,
  moveArea,
  resizeArea,
  type AreaHandle,
  type ShareArtPhotoArea,
  type ShareArtRect,
  type ShareArtText,
} from '@/lib/share-art-config';
import { artFont } from '@/lib/share-art-custom';
import { cn } from '@/lib/utils';

const HANDLE_POSITION: Record<AreaHandle, string> = {
  nw: 'left-0 top-0 cursor-nwse-resize',
  n: 'left-1/2 top-0 cursor-ns-resize',
  ne: 'left-full top-0 cursor-nesw-resize',
  e: 'left-full top-1/2 cursor-ew-resize',
  se: 'left-full top-full cursor-nwse-resize',
  s: 'left-1/2 top-full cursor-ns-resize',
  sw: 'left-0 top-full cursor-nesw-resize',
  w: 'left-0 top-1/2 cursor-ew-resize',
};

const HANDLE_LABEL: Record<AreaHandle, string> = {
  nw: 'canto superior esquerdo',
  n: 'borda de cima',
  ne: 'canto superior direito',
  e: 'borda direita',
  se: 'canto inferior direito',
  s: 'borda de baixo',
  sw: 'canto inferior esquerdo',
  w: 'borda esquerda',
};

/** Which area is being edited: the photo, or a text (REA-47: the name or the role). */
export type EditorAreaKey = 'photo' | 'name' | 'role';

interface Drag {
  key: EditorAreaKey;
  mode: 'move' | AreaHandle;
  startX: number;
  startY: number;
  start: ShareArtRect & { radius?: number };
  width: number;
  height: number;
}

/** REA-47: a text area shown (and editable) over the background, with its text as a preview. */
export interface EditorTextArea {
  key: Exclude<EditorAreaKey, 'photo'>;
  label: string;
  style: ShareArtText;
  /** The sample text shown inside it. */
  preview: string;
}

interface ShareArtAreaEditorProps {
  backgroundUrl: string;
  /** width / height of the background (9:16 → 0.5625) */
  imageRatio: number;
  area: ShareArtPhotoArea;
  onChange: (area: ShareArtPhotoArea) => void;
  /** Keep the area square in pixels while resizing. */
  square: boolean;
  /** Sample photo shown inside the area, so the editor is a live preview too. */
  photoUrl: string | null;
  /** REA-47: the name and role areas. */
  texts?: EditorTextArea[];
  onTextChange?: (key: EditorTextArea['key'], style: ShareArtText) => void;
  /** The area with handles (the others are dimmed and get selected on a click). */
  active?: EditorAreaKey;
  onSelect?: (key: EditorAreaKey) => void;
  className?: string;
}

const pct = (value: number) => `${(value * 100).toFixed(4)}%`;

const position = (area: ShareArtRect) => ({
  left: pct(area.x),
  top: pct(area.y),
  width: pct(area.width),
  height: pct(area.height),
});

const placement = (label: string, area: ShareArtRect) =>
  `${label}: ${Math.round(area.x * 100)}% da esquerda, ${Math.round(area.y * 100)}% do topo, ${Math.round(area.width * 100)}% × ${Math.round(area.height * 100)}%. Arraste ou use as setas para mover.`;

function Handles({
  onStart,
}: {
  onStart: (handle: AreaHandle) => (event: PointerEvent<HTMLElement>) => void;
}) {
  return (
    <>
      {AREA_HANDLES.map(handle => (
        <span
          key={handle}
          role="presentation"
          aria-label={`Redimensionar pelo ${HANDLE_LABEL[handle]}`}
          data-handle={handle}
          className={cn(
            'absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-primary bg-white shadow',
            HANDLE_POSITION[handle]
          )}
          onPointerDown={onStart(handle)}
        />
      ))}
    </>
  );
}

/**
 * The background with the photo area (and, REA-47, the name and role areas) on top: drag an area
 * to move it, drag a handle of the selected one to resize it; arrow keys move the focused one
 * (Shift for bigger steps). Everything is in fractions of the image.
 */
export function ShareArtAreaEditor({
  backgroundUrl,
  imageRatio,
  area,
  onChange,
  square,
  photoUrl,
  texts = [],
  onTextChange,
  active = 'photo',
  onSelect,
  className,
}: ShareArtAreaEditorProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () =>
      setSize({ width: box.clientWidth, height: box.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const areaOf = (key: EditorAreaKey) =>
    key === 'photo' ? area : texts.find(text => text.key === key)?.style;

  const emit = (key: EditorAreaKey, next: ShareArtRect) => {
    if (key === 'photo') onChange(next as ShareArtPhotoArea);
    else onTextChange?.(key, next as ShareArtText);
  };

  const start =
    (key: EditorAreaKey, mode: Drag['mode']) =>
    (event: PointerEvent<HTMLElement>) => {
      const box = boxRef.current;
      const current = areaOf(key);
      if (!box || !current || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (key !== active) onSelect?.(key);
      const rect = box.getBoundingClientRect();
      drag.current = {
        key,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        start: current,
        width: rect.width,
        height: rect.height,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };

  const move = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || !current.width || !current.height) return;
    const dx = (event.clientX - current.startX) / current.width;
    const dy = (event.clientY - current.startY) / current.height;
    const isPhoto = current.key === 'photo';
    emit(
      current.key,
      current.mode === 'move'
        ? moveArea(current.start, dx, dy)
        : resizeArea(current.start, current.mode, dx, dy, {
            imageRatio,
            square: isPhoto && square,
            minSide: isPhoto ? SHARE_ART_MIN_AREA_SIDE : SHARE_ART_MIN_TEXT_SIDE,
          })
    );
  };

  const end = () => {
    drag.current = null;
  };

  const onKeyDown =
    (key: EditorAreaKey) => (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 0.05 : 0.01;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = delta[event.key];
      const current = areaOf(key);
      if (!d || !current) return;
      event.preventDefault();
      emit(key, moveArea(current, d[0], d[1]));
    };

  const radius = areaToPixels(area, size.width, size.height).radius;
  const photoActive = active === 'photo';

  return (
    <div
      ref={boxRef}
      data-testid="share-art-area-editor"
      className={cn(
        'relative w-full touch-none select-none overflow-hidden rounded-lg bg-muted',
        className
      )}
      style={{ aspectRatio: String(imageRatio) }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob or CMS image, edited in place */}
      <img
        src={backgroundUrl}
        alt="Imagem de fundo"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <div className={cn('absolute', photoActive && 'z-[5]')} style={position(area)}>
        <div
          role="group"
          tabIndex={0}
          aria-label={placement('Área da foto', area)}
          aria-current={photoActive || undefined}
          className={cn(
            'absolute inset-0 cursor-move overflow-hidden outline-2 outline-offset-2 outline-dashed focus-visible:outline-primary',
            photoActive ? 'outline-white' : 'outline-white/50'
          )}
          style={{
            borderRadius: radius,
            boxShadow: photoActive ? '0 0 0 9999px rgba(0, 0, 0, 0.35)' : undefined,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backgroundImage: photoUrl ? `url("${photoUrl}")` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onPointerDown={start('photo', 'move')}
          onKeyDown={onKeyDown('photo')}
        />
        {photoActive && <Handles onStart={handle => start('photo', handle)} />}
      </div>

      {texts.map(text => {
        const isActive = active === text.key;
        const px = Math.min(
          text.style.size * size.width,
          (text.style.height * size.height) / 1.15
        );
        return (
          <div
            key={text.key}
            className={cn('absolute', isActive && 'z-[6]')}
            style={position(text.style)}
          >
            <div
              role="group"
              tabIndex={0}
              aria-label={placement(text.label, text.style)}
              aria-current={isActive || undefined}
              data-text-area={text.key}
              className={cn(
                'absolute inset-0 flex cursor-move items-center overflow-hidden whitespace-nowrap outline-2 outline-offset-2 outline-dashed focus-visible:outline-primary',
                isActive ? 'bg-black/20 outline-white' : 'outline-white/50'
              )}
              style={{
                justifyContent:
                  text.style.align === 'left'
                    ? 'flex-start'
                    : text.style.align === 'right'
                      ? 'flex-end'
                      : 'center',
                color: text.style.color,
                font: size.width ? artFont(text.style.font, px) : undefined,
                lineHeight: 1,
              }}
              onPointerDown={start(text.key, 'move')}
              onKeyDown={onKeyDown(text.key)}
            >
              {text.preview}
            </div>
            {isActive && <Handles onStart={handle => start(text.key, handle)} />}
          </div>
        );
      })}
    </div>
  );
}
