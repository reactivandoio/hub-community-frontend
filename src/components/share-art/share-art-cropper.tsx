'use client';

import { Minus, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface ShareArtCropperProps {
  imageSrc: string;
  /** width / height of the photo frame in the art */
  aspect: number;
  onConfirm: (area: Area) => void;
  onCancel: () => void;
}

export function ShareArtCropper({
  imageSrc,
  aspect,
  onConfirm,
  onCancel,
}: ShareArtCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  const handleCropComplete = useCallback(
    (_area: Area, pixels: Area) => setArea(pixels),
    []
  );

  return (
    <div className="space-y-4">
      <div className="relative h-80 w-full overflow-hidden rounded-xl bg-black sm:h-96">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          showGrid
        />
      </div>

      <div className="flex items-center gap-3">
        <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Slider
          value={[zoom]}
          min={1}
          max={3}
          step={0.05}
          onValueChange={([value]) => setZoom(value)}
          aria-label="Zoom"
        />
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          disabled={!area}
          onClick={() => area && onConfirm(area)}
        >
          Confirmar corte
        </Button>
      </div>
    </div>
  );
}
