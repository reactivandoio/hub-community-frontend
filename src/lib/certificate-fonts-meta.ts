// Cursive fonts available for typed signatures on certificates. Pure metadata — no
// react-pdf import — so it is safe to use from types.ts, forms and any client code.
// The TTFs live in public/fonts (SIL OFL 1.1, see public/fonts/OFL.txt). Note that
// DancingScript-Regular.ttf is the variable `DancingScript[wght].ttf` (no static build
// upstream); react-pdf and the CSS @font-face use it at its default (Regular) instance.

export const SIGNATURE_FONTS = {
  great_vibes: { label: 'Great Vibes', family: 'GreatVibes', file: 'GreatVibes-Regular.ttf' },
  allura: { label: 'Allura', family: 'Allura', file: 'Allura-Regular.ttf' },
  dancing_script: { label: 'Dancing Script', family: 'DancingScript', file: 'DancingScript-Regular.ttf' },
} as const;

export type SignatureFont = keyof typeof SIGNATURE_FONTS;

export const SIGNATURE_FONT_KEYS = Object.keys(SIGNATURE_FONTS) as [SignatureFont, ...SignatureFont[]];

export const DEFAULT_SIGNATURE_FONT: SignatureFont = 'great_vibes';

export function isSignatureFont(value: unknown): value is SignatureFont {
  return typeof value === 'string' && value in SIGNATURE_FONTS;
}

/** Width of the PDF signature slot in pt (4 slots) and in the compact 5-slot row. */
export const SIGNATURE_SLOT_WIDTH = 150;
export const SIGNATURE_SLOT_WIDTH_COMPACT = 130;
export const MAX_SIGNATURE_FONT_SIZE = 26;
export const MIN_SIGNATURE_FONT_SIZE = 12;

/**
 * Cursive font size (pt) so the typed signature fits its slot on one line. All three fonts
 * advance ≈0.40 × fontSize per character (measured with fontkit), so `slotWidth / (0.4 × len)`
 * is the largest size that fits; capped at 26pt, floored at 12pt for legibility (react-pdf's
 * maxLines/ellipsis is the last resort past that). The admin form mirrors this for its sample.
 */
export function cursiveFontSize(text: string, compact = false): number {
  const slot = (compact ? SIGNATURE_SLOT_WIDTH_COMPACT : SIGNATURE_SLOT_WIDTH) - 4;
  const fit = Math.floor(slot / (0.4 * Math.max(1, text.trim().length)));
  return Math.min(MAX_SIGNATURE_FONT_SIZE, Math.max(MIN_SIGNATURE_FONT_SIZE, fit));
}

/** Font family to hand to react-pdf for a signature; unknown/null values fall back to the default. */
export function signatureFontFamily(font: string | null | undefined): string {
  return SIGNATURE_FONTS[isSignatureFont(font) ? font : DEFAULT_SIGNATURE_FONT].family;
}
