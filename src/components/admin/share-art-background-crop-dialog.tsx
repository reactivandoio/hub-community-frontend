'use client';

import { Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { getCroppedImg } from '@/lib/get-cropped-img';
import { SHARE_ART_FORMATS, type ShareArtFormat } from '@/lib/share-art';
import { cropProblem, imageRatioOf } from '@/lib/share-art-config';

const MAX_ZOOM = 4;

interface ShareArtBackgroundCropDialogProps {
  /** The image to crop (object URL of the picked file, or a same-origin URL); null closes it. */
  imageSrc: string | null;
  format: ShareArtFormat;
  /** Why the dialog opened: the picked image is not in the format's ratio. */
  wrongRatio?: { width: number; height: number } | null;
  onCancel: () => void;
  /** The background, already cropped to the format's exact size (1080×1920 or 1080×1350). */
  onCropped: (file: File) => void | Promise<void>;
}

/**
 * REA-45: crops a background of the "eu vou" art to its format (Stories 9:16, Feed 4:5) — the ratio
 * is locked; drag and zoom choose the part. The crop is scaled down to the format's size, never up:
 * a crop narrower than the format's width (too much zoom on a small image) cannot be confirmed.
 */
export function ShareArtBackgroundCropDialog({
  imageSrc,
  format,
  wrongRatio,
  onCancel,
  onCropped,
}: ShareArtBackgroundCropDialogProps) {
  const spec = SHARE_ART_FORMATS[format];
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new image starts centered, without zoom.
  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setPixels(null);
    setError(null);
  }, [imageSrc]);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setPixels(areaPixels);
  }, []);

  const problem = pixels ? cropProblem(format, pixels.width) : null;

  const confirm = async () => {
    if (!imageSrc || !pixels || problem) return;
    setBusy(true);
    setError(null);
    try {
      const file = await getCroppedImg(
        imageSrc,
        pixels,
        spec.width,
        spec.height,
        `fundo-${format}-${spec.width}x${spec.height}.jpg`
      );
      await onCropped(file);
    } catch {
      setError('Não foi possível recortar a imagem. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!imageSrc} onOpenChange={open => !open && !busy && onCancel()}>
      <DialogContent className="max-h-[90vh] sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>
            Recortar o fundo do {spec.label} ({spec.ratio})
          </DialogTitle>
          <DialogDescription>
            {wrongRatio
              ? `A imagem tem ${wrongRatio.width}×${wrongRatio.height}, fora da proporção ${spec.ratio}. `
              : ''}
            Arraste e use o zoom para escolher a parte da imagem. O fundo fica
            com {spec.width}×{spec.height} pixels.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[50vh] max-h-[420px] min-h-[260px] w-full overflow-hidden rounded-lg bg-black/90">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              maxZoom={MAX_ZOOM}
              aspect={imageRatioOf(format)}
              onCropChange={setCrop}
              onCropComplete={handleCropComplete}
              onZoomChange={setZoom}
              cropShape="rect"
              showGrid
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Diminuir zoom"
            onClick={() => setZoom(z => Math.max(1, z - 0.1))}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Slider
            value={[zoom]}
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            onValueChange={values => setZoom(values[0])}
            className="flex-1"
            thumbLabel="Zoom do recorte"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Aumentar zoom"
            onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.1))}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-2 text-muted-foreground"
            onClick={() => {
              setCrop({ x: 0, y: 0 });
              setZoom(1);
            }}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Centralizar
          </Button>
        </div>

        {pixels && (
          <p className="text-sm text-muted-foreground" data-testid="crop-size">
            Recorte de {Math.round(pixels.width)}×{Math.round(pixels.height)}{' '}
            pixels da imagem original.
          </p>
        )}
        {(problem || error) && (
          <p role="alert" className="text-sm text-destructive">
            {problem || error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={busy || !pixels || !!problem}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Usar recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
