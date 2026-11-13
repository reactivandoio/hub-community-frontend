import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareArtBackgroundCropDialog } from '@/components/admin/share-art-background-crop-dialog';

// react-easy-crop needs layout; the stub reports the crop the test picks, as the real one does
// after a drag or a zoom (pixels of the original image).
let cropPixels = { x: 0, y: 0, width: 2251, height: 2814 };
let lastCropper: any = null;
vi.mock('react-easy-crop', async () => {
  const { useEffect } = await import('react');
  return {
    default: (props: any) => {
      lastCropper = props;
      useEffect(() => {
        props.onCropComplete({ x: 0, y: 0, width: 100, height: 100 }, cropPixels);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [props.zoom]);
      return <div data-testid="cropper" />;
    },
  };
});

const mockGetCroppedImg = vi.fn();
vi.mock('@/lib/get-cropped-img', () => ({
  getCroppedImg: (...args: unknown[]) => mockGetCroppedImg(...args),
}));

beforeEach(() => {
  cropPixels = { x: 0, y: 0, width: 2251, height: 2814 };
  lastCropper = null;
  mockGetCroppedImg.mockReset().mockResolvedValue(new File(['c'], 'c.jpg', { type: 'image/jpeg' }));
});

describe('ShareArtBackgroundCropDialog (REA-45)', () => {
  it('locks the crop to the format and outputs the exact background size', async () => {
    const onCropped = vi.fn();
    render(
      <ShareArtBackgroundCropDialog
        imageSrc="blob:bg"
        format="feed"
        wrongRatio={{ width: 2251, height: 2814 }}
        onCancel={vi.fn()}
        onCropped={onCropped}
      />
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Recortar o fundo do Feed (4:5)');
    expect(screen.getByRole('dialog')).toHaveTextContent('A imagem tem 2251×2814, fora da proporção 4:5.');
    expect(lastCropper.aspect).toBe(0.8);
    expect(screen.getByTestId('crop-size')).toHaveTextContent('Recorte de 2251×2814 pixels');

    await userEvent.click(screen.getByRole('button', { name: 'Usar recorte' }));
    await waitFor(() => expect(onCropped).toHaveBeenCalled());
    expect(mockGetCroppedImg).toHaveBeenCalledWith('blob:bg', cropPixels, 1080, 1350, 'fundo-feed-1080x1350.jpg');
  });

  it('uses 9:16 and 1080×1920 for Stories', async () => {
    cropPixels = { x: 0, y: 0, width: 1200, height: 2133 };
    render(
      <ShareArtBackgroundCropDialog imageSrc="blob:bg" format="story" onCancel={vi.fn()} onCropped={vi.fn()} />
    );
    expect(lastCropper.aspect).toBeCloseTo(9 / 16);
    await userEvent.click(screen.getByRole('button', { name: 'Usar recorte' }));
    await waitFor(() => expect(mockGetCroppedImg).toHaveBeenCalled());
    expect(mockGetCroppedImg.mock.calls[0].slice(2, 4)).toEqual([1080, 1920]);
  });

  it('does not take a crop narrower than 1080 px (too much zoom): it would be enlarged', () => {
    cropPixels = { x: 300, y: 300, width: 900, height: 1125 };
    render(
      <ShareArtBackgroundCropDialog imageSrc="blob:bg" format="feed" onCancel={vi.fn()} onCropped={vi.fn()} />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'O recorte tem 900 px de largura; o fundo do Feed precisa de ao menos 1080 px. Diminua o zoom.'
    );
    expect(screen.getByRole('button', { name: 'Usar recorte' })).toBeDisabled();
  });

  it('cancels', async () => {
    const onCancel = vi.fn();
    render(
      <ShareArtBackgroundCropDialog imageSrc="blob:bg" format="feed" onCancel={onCancel} onCropped={vi.fn()} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('is closed without an image', () => {
    render(
      <ShareArtBackgroundCropDialog imageSrc={null} format="feed" onCancel={vi.fn()} onCropped={vi.fn()} />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
