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

// ─── REA-47: name and role ───────────────────────────────────────────────────────────────
import { artFont, drawArtText } from '../share-art-custom';
import type { ShareArtText } from '../share-art-config';

/** A recorder whose measureText gives 0.5 × font size per character (read from ctx.font). */
function textRecorder() {
  const base = recorder();
  const ctx = base.ctx as unknown as Record<string, unknown>;
  ctx.measureText = (text: string) => {
    const px = Number(/ (\d+(?:\.\d+)?)px /.exec(String(ctx.font))?.[1] ?? 0);
    return { width: text.length * px * 0.5 };
  };
  return base;
}

const NAME: ShareArtText = {
  x: 0.1, y: 0.7, width: 0.8, height: 0.05, font: 'inter_bold', size: 0.05, color: '#ff0000', align: 'center',
};

describe('drawArtText (REA-47)', () => {
  it('draws the text centered in its area, in its color, at its size (fraction of the width)', () => {
    const { ctx, named } = textRecorder();
    drawArtText(ctx, { text: 'Ana', style: NAME }, 1080, 1920);
    // Area: x 108..972 (864 wide), y 1344..1440 → middle 1392. Size 0.05 × 1080 = 54px.
    expect(named('fillText')).toEqual([['fillText', 'Ana', 540, 1392]]);
    const c = ctx as unknown as Record<string, unknown>;
    expect(c.fillStyle).toBe('#ff0000');
    expect(c.textAlign).toBe('center');
    expect(c.textBaseline).toBe('middle');
    expect(String(c.font)).toMatch(/^800 54px /);
  });

  it('anchors left and right alignment on the edges of the area', () => {
    const left = textRecorder();
    drawArtText(left.ctx, { text: 'Ana', style: { ...NAME, align: 'left' } }, 1080, 1920);
    expect(left.named('fillText')[0][2]).toBeCloseTo(108);
    const right = textRecorder();
    drawArtText(right.ctx, { text: 'Ana', style: { ...NAME, align: 'right' } }, 1080, 1920);
    expect(right.named('fillText')[0][2]).toBeCloseTo(972);
  });

  it('shrinks a long text to fit the width of its area', () => {
    const { ctx } = textRecorder();
    const long = 'Maria Aparecida dos Santos Oliveira Silva'; // 41 chars: 41 × 27 = 1107px at 54px
    drawArtText(ctx, { text: long, style: NAME }, 1080, 1920);
    const px = Number(/ (\d+(?:\.\d+)?)px /.exec(String((ctx as unknown as Record<string, unknown>).font))![1]);
    expect(px).toBeLessThan(54);
    expect(long.length * px * 0.5).toBeLessThanOrEqual(864);
  });

  it('draws nothing for an empty text', () => {
    const { ctx, named } = textRecorder();
    drawArtText(ctx, { text: '   ', style: NAME }, 1080, 1920);
    expect(named('fillText')).toEqual([]);
  });

  it('drawCustomArt draws the texts over the photo, after the clip is restored', () => {
    const { ctx, calls } = textRecorder();
    drawCustomArt(ctx, {
      width: 1080,
      height: 1920,
      background,
      photo,
      area: { x: 0.25, y: 0.3, width: 0.5, height: 0.28125, radius: 1 },
      texts: [
        { text: 'Ana', style: NAME },
        { text: 'Mentora', style: { ...NAME, y: 0.76, font: 'dancing_script' } },
      ],
    });
    const order = calls.map(c => c[0]);
    const firstText = order.indexOf('fillText');
    expect(firstText).toBeGreaterThan(order.lastIndexOf('drawImage'));
    expect(firstText).toBeGreaterThan(order.indexOf('restore'));
    expect(calls.filter(c => c[0] === 'fillText').map(c => c[1])).toEqual(['Ana', 'Mentora']);
  });

  it('maps each font to a canvas font', () => {
    expect(artFont('serif_bold', 40)).toBe('700 40px Georgia, "Times New Roman", serif');
    expect(artFont('great_vibes', 40)).toBe('400 40px "GreatVibes", cursive');
    expect(artFont('inter', 40)).toMatch(/^400 40px .*Inter/i);
  });
});
