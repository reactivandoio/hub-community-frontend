'use client';

import { useEffect, useRef, useState } from 'react';

import type { ShareArtPhotoArea } from '@/lib/share-art-config';
import { drawCustomArt, loadArtImage } from '@/lib/share-art-custom';
import { cn } from '@/lib/utils';

/** Loads an image for canvas drawing; null while loading or when it fails. */
export function useArtImage(
  src: string | null | undefined
): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    let cancelled = false;
    loadArtImage(src)
      .then(img => !cancelled && setImage(img))
      .catch(() => !cancelled && setImage(null));
    return () => {
      cancelled = true;
    };
  }, [src]);
  return image;
}

interface CustomArtCanvasProps {
  backgroundUrl: string | null;
  photoUrl: string | null;
  area: ShareArtPhotoArea;
  /** CSS size of the preview; drawn at the device pixel ratio. */
  width: number;
  height: number;
  className?: string;
  label?: string;
}

/**
 * The custom art drawn by the same function as the participant's PNG (`drawCustomArt`), at a
 * preview size: what the organizer sees here is what the participant downloads.
 */
export function CustomArtCanvas({
  backgroundUrl,
  photoUrl,
  area,
  width,
  height,
  className,
  label = 'Prévia da arte',
}: CustomArtCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const background = useArtImage(backgroundUrl);
  const photo = useArtImage(photoUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !background) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCustomArt(ctx, {
      width: canvas.width,
      height: canvas.height,
      background,
      photo,
      area,
    });
  }, [background, photo, area, width, height]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={cn('block rounded-lg bg-muted shadow', className)}
      style={{ width, height }}
    />
  );
}
