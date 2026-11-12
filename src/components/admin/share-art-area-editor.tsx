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
  areaToPixels,
  moveArea,
  resizeArea,
  type AreaHandle,
  type ShareArtPhotoArea,
} from '@/lib/share-art-config';
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

interface Drag {
  mode: 'move' | AreaHandle;
  startX: number;
  startY: number;
  start: ShareArtPhotoArea;
  width: number;
  height: number;
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
  className?: string;
}

const pct = (value: number) => `${(value * 100).toFixed(4)}%`;

/**
 * The background with the photo area on top: drag the area to move it, drag a handle to resize
 * it; arrow keys move it (Shift for bigger steps). Everything is in fractions of the image.
 */
export function ShareArtAreaEditor({
  backgroundUrl,
  imageRatio,
  area,
  onChange,
  square,
  photoUrl,
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

  const start = (mode: Drag['mode']) => (event: PointerEvent<HTMLElement>) => {
    const box = boxRef.current;
    if (!box || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = box.getBoundingClientRect();
    drag.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      start: area,
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
    onChange(
      current.mode === 'move'
        ? moveArea(current.start, dx, dy)
        : resizeArea(current.start, current.mode, dx, dy, {
            imageRatio,
            square,
          })
    );
  };

  const end = () => {
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    onChange(moveArea(area, d[0], d[1]));
  };

  const radius = areaToPixels(area, size.width, size.height).radius;

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
      <div
        className="absolute"
        style={{
          left: pct(area.x),
          top: pct(area.y),
          width: pct(area.width),
          height: pct(area.height),
        }}
      >
        <div
          role="group"
          tabIndex={0}
          aria-label={`Área da foto: ${Math.round(area.x * 100)}% da esquerda, ${Math.round(area.y * 100)}% do topo, ${Math.round(area.width * 100)}% × ${Math.round(area.height * 100)}%. Arraste ou use as setas para mover.`}
          className="absolute inset-0 cursor-move overflow-hidden outline-2 outline-offset-2 outline-dashed outline-white focus-visible:outline-primary"
          style={{
            borderRadius: radius,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backgroundImage: photoUrl ? `url("${photoUrl}")` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onPointerDown={start('move')}
          onKeyDown={onKeyDown}
        />
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
            onPointerDown={start(handle)}
          />
        ))}
      </div>
    </div>
  );
}
