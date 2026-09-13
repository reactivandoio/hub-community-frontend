import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SIGNATURE_FONT,
  SIGNATURE_FONTS,
  cursiveFontSize,
  isSignatureFont,
  signatureFontFamily,
} from '@/lib/certificate-fonts-meta';

describe('signature font metadata', () => {
  it('resolves families and falls back to the default', () => {
    expect(signatureFontFamily('allura')).toBe(SIGNATURE_FONTS.allura.family);
    expect(signatureFontFamily(null)).toBe(SIGNATURE_FONTS[DEFAULT_SIGNATURE_FONT].family);
    expect(signatureFontFamily('comic_sans')).toBe(SIGNATURE_FONTS[DEFAULT_SIGNATURE_FONT].family);
    expect(isSignatureFont('dancing_script')).toBe(true);
    expect(isSignatureFont('')).toBe(false);
  });
});

describe('cursiveFontSize', () => {
  it('uses the full size for short names and steps down with length', () => {
    expect(cursiveFontSize('Ana Souza')).toBe(26);
    expect(cursiveFontSize('Pedro Duarte')).toBe(26);
    expect(cursiveFontSize('Bia Lima Ferreira')).toBe(21);
    expect(cursiveFontSize('Maria Clara de Souza')).toBe(18);
    expect(cursiveFontSize('Maria Clara de Souza Andrade')).toBe(13);
  });
  it('is smaller in the compact row and never below the floor', () => {
    expect(cursiveFontSize('Bia Lima Ferreira', true)).toBe(18);
    expect(cursiveFontSize('Ana Beatriz Gonçalves de Oliveira Lima', true)).toBe(12);
    expect(cursiveFontSize('', true)).toBe(26);
  });
});
