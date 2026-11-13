import { describe, expect, it } from 'vitest';

import {
  SHARE_ART_MIN_AREA_SIDE,
  areaAspect,
  areaToPixels,
  backgroundProblem,
  coverSource,
  customFormatOf,
  defaultPhotoArea,
  formatInput,
  isSquareArea,
  placesRoleText,
  rolesInput,
  moveArea,
  ratioMatches,
  resizeArea,
  squareArea,
  type ShareArtPhotoArea,
  cropProblem,
  cropSourceProblem,
  maxCropWidth,
  SHARE_ART_FONTS,
  SHARE_ART_MIN_TEXT_SIDE,
  defaultTextArea,
  fitTextSize,
} from '../share-art-config';

const STORY = 9 / 16;
const close = (a: ShareArtPhotoArea, b: Partial<ShareArtPhotoArea>) =>
  Object.entries(b).forEach(([key, value]) =>
    expect(a[key as keyof ShareArtPhotoArea]).toBeCloseTo(value as number, 5)
  );

describe('background checks (same rule as the BFF)', () => {
  it('accepts 9:16 for stories and 4:5 for the feed (REA-47), up to 1% off', () => {
    expect(backgroundProblem('story', 1080, 1920)).toBeNull();
    expect(backgroundProblem('story', 1080, 1910)).toBeNull();
    expect(backgroundProblem('feed', 2048, 2560)).toBeNull();
    expect(backgroundProblem('feed', 1080, 1350)).toBeNull();
    // The old square feed is refused now.
    expect(backgroundProblem('feed', 2048, 2048)).toBe(
      'O fundo do Feed (4:5) precisa ter proporção 4:5 (a enviada tem 2048×2048).'
    );
    expect(ratioMatches(1080, 1900, STORY)).toBe(false);
  });

  it('tells which ratio is expected and what was sent', () => {
    expect(backgroundProblem('story', 1080, 1350)).toBe(
      'O fundo do Stories (9:16) precisa ter proporção 9:16 (a enviada tem 1080×1350).'
    );
    expect(backgroundProblem('feed', 1080, 1920)).toBe(
      'O fundo do Feed (4:5) precisa ter proporção 4:5 (a enviada tem 1080×1920).'
    );
  });

  it('refuses a background smaller than the exported art', () => {
    expect(backgroundProblem('story', 720, 1280)).toMatch(
      /ao menos 1080×1920 pixels \(a enviada tem 720×1280\)/
    );
  });
});

describe('customFormatOf', () => {
  const area = { x: 0, y: 0, width: 1, height: 1, radius: 0 };
  it('is the format only when it has a background and an area', () => {
    const config = {
      story: { background: 'https://cdn/s.png', background_id: '1', photo_area: area },
      feed: null,
    };
    expect(customFormatOf(config, 'story')?.background_id).toBe('1');
    expect(customFormatOf(config, 'feed')).toBeNull();
    expect(customFormatOf(null, 'story')).toBeNull();
  });
});

describe('default and square areas', () => {
  it('starts as a centered circle, square in pixels, on both formats', () => {
    const story = defaultPhotoArea('story');
    close(story, { x: 0.2, width: 0.6, height: 0.3375, radius: 1 });
    expect(story.y + story.height / 2).toBeCloseTo(0.5, 5);
    expect(isSquareArea(story, STORY)).toBe(true);
    expect(areaAspect(story, STORY)).toBeCloseTo(1, 5);
    const feed = defaultPhotoArea('feed');
    close(feed, { x: 0.2, y: 0.26, width: 0.6, height: 0.48 });
    expect(isSquareArea(feed, 4 / 5)).toBe(true);
  });

  it('squares an area around its center, by its smaller side', () => {
    const tall = { x: 0.1, y: 0.1, width: 0.4, height: 0.5, radius: 0.5 };
    const square = squareArea(tall, STORY);
    // 0.4 of the width = 0.225 of the height in pixels: the smaller side.
    close(square, { width: 0.4, height: 0.225, radius: 0.5 });
    expect(square.y + square.height / 2).toBeCloseTo(0.35, 5);
    expect(isSquareArea(square, STORY)).toBe(true);
  });

  it('keeps a squared area inside the image', () => {
    const square = squareArea({ x: 0.9, y: 0.95, width: 0.1, height: 0.05, radius: 0 }, 1);
    expect(square.x + square.width).toBeLessThanOrEqual(1);
    expect(square.y + square.height).toBeLessThanOrEqual(1);
  });
});

describe('moveArea', () => {
  const area = { x: 0.2, y: 0.2, width: 0.5, height: 0.5, radius: 0 };
  it('moves by fractions of the image', () => {
    close(moveArea(area, 0.1, -0.05), { x: 0.3, y: 0.15 });
  });
  it('stops at the edges', () => {
    close(moveArea(area, 1, 1), { x: 0.5, y: 0.5 });
    close(moveArea(area, -1, -1), { x: 0, y: 0 });
  });
});

describe('resizeArea', () => {
  const area = { x: 0.2, y: 0.2, width: 0.4, height: 0.4, radius: 0.3 };

  it('moves only the dragged edges', () => {
    close(resizeArea(area, 'se', 0.1, 0.2, { imageRatio: 1 }), {
      x: 0.2,
      y: 0.2,
      width: 0.5,
      height: 0.6,
      radius: 0.3,
    });
    close(resizeArea(area, 'nw', -0.1, -0.1, { imageRatio: 1 }), {
      x: 0.1,
      y: 0.1,
      width: 0.5,
      height: 0.5,
    });
    close(resizeArea(area, 'e', 0.1, 0.5, { imageRatio: 1 }), { width: 0.5, height: 0.4 });
  });

  it('never leaves the image nor gets smaller than the minimum', () => {
    close(resizeArea(area, 'se', 5, 5, { imageRatio: 1 }), { width: 0.8, height: 0.8 });
    close(resizeArea(area, 'nw', -5, -5, { imageRatio: 1 }), { x: 0, y: 0, width: 0.6 });
    const tiny = resizeArea(area, 'se', -5, -5, { imageRatio: 1 });
    expect(tiny.width).toBeCloseTo(SHARE_ART_MIN_AREA_SIDE, 5);
    expect(tiny.height).toBeCloseTo(SHARE_ART_MIN_AREA_SIDE, 5);
  });

  it('keeps the area square in pixels on a 9:16 image, anchored on the opposite corner', () => {
    const start = squareArea({ x: 0.2, y: 0.3, width: 0.4, height: 0.225, radius: 1 }, STORY);
    const out = resizeArea(start, 'se', 0.2, 0, { imageRatio: STORY, square: true });
    expect(isSquareArea(out, STORY)).toBe(true);
    close(out, { x: start.x, y: start.y, width: 0.6 });

    const north = resizeArea(start, 'n', 0, -0.1, { imageRatio: STORY, square: true });
    expect(isSquareArea(north, STORY)).toBe(true);
    expect(north.y + north.height).toBeCloseTo(start.y + start.height, 5);
  });

  it('shrinks a square that would leave the image', () => {
    const start = { x: 0.5, y: 0.5, width: 0.3, height: 0.3, radius: 1 };
    const out = resizeArea(start, 'se', 0.9, 0.9, { imageRatio: 1, square: true });
    close(out, { x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
  });
});

describe('areaToPixels', () => {
  it('turns fractions into pixels of any size (resolution independent)', () => {
    const area = { x: 0.25, y: 0.5, width: 0.5, height: 0.25, radius: 1 };
    expect(areaToPixels(area, 1080, 1920)).toEqual({
      left: 270,
      top: 960,
      width: 540,
      height: 480,
      radius: 240,
    });
    expect(areaToPixels(area, 360, 640).radius).toBe(80);
  });
  it('maps radius 0 to square corners', () => {
    expect(areaToPixels({ x: 0, y: 0, width: 1, height: 1, radius: 0 }, 100, 100).radius).toBe(0);
  });
});

describe('coverSource', () => {
  it('crops the center of a wider photo to fill a square', () => {
    expect(coverSource(200, 100, 50, 50)).toEqual({ sx: 50, sy: 0, sw: 100, sh: 100 });
  });
  it('crops the center of a taller photo', () => {
    expect(coverSource(100, 300, 100, 100)).toEqual({ sx: 0, sy: 100, sw: 100, sh: 100 });
  });
});

describe('formatInput', () => {
  it('sends the media id and the rounded area, or null for the default art', () => {
    expect(
      formatInput({
        backgroundId: '42',
        area: { x: 0.1234567891, y: 0, width: 0.5, height: 0.5, radius: 1 },
      })
    ).toEqual({
      background: '42',
      photo_area: { x: 0.123457, y: 0, width: 0.5, height: 0.5, radius: 1 },
      // REA-47: without texts, the name and the role are off.
      name_text: null,
      role_text: null,
    });
    expect(formatInput({ backgroundId: null, area: defaultPhotoArea('feed') })).toBeNull();
    expect(formatInput(null)).toBeNull();
  });
});

describe('background crop (REA-45)', () => {
  it('widest crop in the format ratio', () => {
    expect(maxCropWidth('feed', 2251, 2814)).toBe(2251);
    expect(maxCropWidth('story', 2251, 2814)).toBe(1582);
    expect(maxCropWidth('story', 1080, 1350)).toBe(759);
  });

  it('refuses an image that is too small even cropped', () => {
    expect(cropSourceProblem('feed', 2251, 2814)).toBeNull();
    expect(cropSourceProblem('story', 1080, 1350)).toBe(
      'A imagem 1080×1350 é pequena demais para o Stories (9:16): cortada nessa proporção, fica com 759 px de largura, e o fundo precisa de ao menos 1080 px.'
    );
  });

  it('needs at least 1080 px of width after the crop', () => {
    expect(cropProblem('feed', 1080)).toBeNull();
    expect(cropProblem('story', 1079.6)).toBeNull();
    expect(cropProblem('feed', 1000)).toBe(
      'O recorte tem 1000 px de largura; o fundo do Feed precisa de ao menos 1080 px. Diminua o zoom.'
    );
  });
});

describe('name and role texts (REA-47)', () => {
  it('start under the default photo, inside the image, centered and white', () => {
    for (const format of ['story', 'feed'] as const) {
      const photo = defaultPhotoArea(format);
      const name = defaultTextArea(format, 'name');
      const role = defaultTextArea(format, 'role');
      expect(name.y).toBeGreaterThanOrEqual(photo.y + photo.height);
      expect(role.y).toBeGreaterThanOrEqual(name.y + name.height);
      expect(role.y + role.height).toBeLessThanOrEqual(1);
      expect(name).toMatchObject({ align: 'center', color: '#ffffff', font: 'inter_bold' });
      expect(role.size).toBeLessThan(name.size);
    }
  });

  it('fits the font size to the area: capped by its height, shrunk to its width', () => {
    const measure = (px: number) => px * 10; // a 10-character text at 0.5 × px per char… × 2
    expect(fitTextSize(measure, { size: 50, areaWidth: 1000, areaHeight: 100 })).toBe(50);
    expect(fitTextSize(measure, { size: 50, areaWidth: 1000, areaHeight: 23 })).toBe(20);
    expect(fitTextSize(measure, { size: 50, areaWidth: 300, areaHeight: 100 })).toBe(30);
  });

  it('sends the texts rounded and without __typename, or null when off', () => {
    const name = {
      __typename: 'ShareArtText', x: 0.1234567891, y: 0.7, width: 0.8, height: 0.05,
      font: 'inter_bold' as const, size: 0.05, color: '#ffffff', align: 'center' as const,
    };
    const out = formatInput({
      backgroundId: '42',
      area: { __typename: 'ShareArtPhotoArea', x: 0, y: 0, width: 0.5, height: 0.5, radius: 1 } as never,
      nameText: name,
      roleText: null,
    });
    expect(out?.photo_area).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5, radius: 1 });
    expect(out?.name_text).toEqual({
      x: 0.123457, y: 0.7, width: 0.8, height: 0.05, font: 'inter_bold', size: 0.05, color: '#ffffff', align: 'center',
    });
    expect(out?.role_text).toBeNull();
  });

  it('has the same fonts as the BFF and the backend', () => {
    expect(SHARE_ART_FONTS.map(font => font.key)).toEqual([
      'inter', 'inter_bold', 'serif', 'serif_bold', 'dancing_script', 'great_vibes', 'allura',
    ]);
  });

  it('moves and resizes a text area like the photo, keeping its style', () => {
    const text = defaultTextArea('story', 'name');
    const moved = moveArea(text, 0.05, -0.1);
    expect(moved).toMatchObject({ font: text.font, size: text.size, color: text.color, align: text.align });
    expect(moved.x).toBeCloseTo(0.15);
    const resized = resizeArea(text, 's', 0, -0.04, { imageRatio: 9 / 16, minSide: SHARE_ART_MIN_TEXT_SIDE });
    expect(resized.height).toBeCloseTo(SHARE_ART_MIN_TEXT_SIDE);
    expect(resized).not.toHaveProperty('radius');
  });
});

// REA-49: roles offered in the generator.
describe('rolesInput / placesRoleText', () => {
  const ALL = ['Participante', 'Líder', 'Mentor'];
  it('sends null when every role is marked, else the marked ones in order', () => {
    expect(rolesInput(['Mentor', 'Participante', 'Líder'], ALL)).toBeNull();
    expect(rolesInput(['Mentor', 'Participante'], ALL)).toEqual(['Participante', 'Mentor']);
    expect(rolesInput([], ALL)).toEqual([]);
  });
  it('counts the role text only on a format with a background', () => {
    const text = defaultTextArea('story', 'role');
    expect(placesRoleText([{ backgroundId: '7', roleText: text }])).toBe(true);
    expect(placesRoleText([{ backgroundId: null, roleText: text }])).toBe(false);
    expect(placesRoleText([{ backgroundId: '7', roleText: null }])).toBe(false);
  });
});
