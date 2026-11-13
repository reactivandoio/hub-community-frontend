import { describe, expect, it } from 'vitest';

import { drawCustomArt, roundedRectPath, type ArtContext } from '../share-art-custom';

/** Records the canvas calls instead of drawing. */
function recorder() {
  const calls: [string, ...unknown[]][] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => calls.push([key, ...args]);
    },
    set(target, key: string, value) {
      target[key] = value;
      calls.push([`set:${key}`, value]);
      return true;
    },
  }) as unknown as ArtContext;
  return { ctx, calls, named: (name: string) => calls.filter(c => c[0] === name) };
}

const background = { width: 1080, height: 1920 } as unknown as HTMLImageElement;
const photo = { width: 800, height: 1000 } as unknown as HTMLImageElement;

describe('drawCustomArt', () => {
  const area = { x: 0.25, y: 0.5, width: 0.5, height: 0.28125, radius: 1 };

  it('draws the background over the whole art, then the photo clipped to the area', () => {
    const { ctx, calls, named } = recorder();
    drawCustomArt(ctx, { width: 1080, height: 1920, background, photo, area });

    expect(named('drawImage')[0]).toEqual(['drawImage', background, 0, 0, 1080, 1920]);
    const order = calls.map(c => c[0]);
    expect(order.indexOf('clip')).toBeLessThan(order.lastIndexOf('drawImage'));
    expect(order.indexOf('save')).toBeLessThan(order.indexOf('clip'));
    expect(order.at(-1)).toBe('restore');

    // Area: 540×540 px at (270, 960). The 800×1000 photo is center-cropped to 800×800.
    expect(named('drawImage')[1]).toEqual(['drawImage', photo, 0, 100, 800, 800, 270, 960, 540, 540]);
  });

  it('rounds the clip by radius × half of the smaller side (a circle at 1)', () => {
    const { ctx, named } = recorder();
    drawCustomArt(ctx, { width: 1080, height: 1920, background, photo, area });
    expect(named('arcTo').every(c => c[5] === 270)).toBe(true);
    expect(named('moveTo')[0]).toEqual(['moveTo', 270 + 270, 960]);
  });

  it('uses square corners at radius 0', () => {
    const { ctx, named } = recorder();
    drawCustomArt(ctx, { width: 1080, height: 1080, background, photo, area: { ...area, radius: 0 } });
    expect(named('arcTo').every(c => c[5] === 0)).toBe(true);
  });

  it('draws the same area at any output size', () => {
    const big = recorder();
    const small = recorder();
    drawCustomArt(big.ctx, { width: 1080, height: 1920, background, photo, area });
    drawCustomArt(small.ctx, { width: 270, height: 480, background, photo, area });
    const [, , , , , , bx, by, bw, bh] = big.named('drawImage')[1] as number[];
    const [, , , , , , sx, sy, sw, sh] = small.named('drawImage')[1] as number[];
    expect([sx * 4, sy * 4, sw * 4, sh * 4]).toEqual([bx, by, bw, bh]);
  });

  it('shows a "sua foto" placeholder in the area while there is no photo', () => {
    const { ctx, named } = recorder();
    drawCustomArt(ctx, { width: 1080, height: 1080, background, photo: null, area });
    expect(named('drawImage')).toHaveLength(1);
    expect(named('fill')).toHaveLength(1);
    expect(named('fillText')[0][1]).toBe('SUA FOTO');
  });
});

describe('roundedRectPath', () => {
  it('caps the radius at half of the smaller side', () => {
    const { ctx, named } = recorder();
    roundedRectPath(ctx, 0, 0, 100, 40, 500);
    expect(named('arcTo').every(c => c[5] === 20)).toBe(true);
  });
});
