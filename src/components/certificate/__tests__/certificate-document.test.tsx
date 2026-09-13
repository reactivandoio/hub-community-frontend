// @vitest-environment node
import { describe, it, expect } from 'vitest';
import React from 'react';
import { inflateSync } from 'node:zlib';
import { renderToBuffer } from '@react-pdf/renderer';
import { CertificateDocument } from '../certificate-document';
import { generateQrDataUrl } from '@/lib/certificate-qr';

// 1x1 transparent PNG — keeps the test offline.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const event = {
  title: 'React Summit Goiânia',
  slug: 'react-summit-goiania',
  start_date: '2026-08-01T12:00:00.000Z',
  end_date: '2026-08-01T21:30:00.000Z',
  location: { title: 'Sebrae', city: 'Goiânia' },
  communities: [{ title: 'Reactivando' }],
};

const render = async (config: Parameters<typeof CertificateDocument>[0]['config']) => {
  const qrDataUrl = await generateQrDataUrl('https://hubcommunity.io/certificado/verificar/RCT-AAAAAAAA');
  const buffer = await renderToBuffer(
    <CertificateDocument
      config={config}
      event={event}
      certificate={{ code: 'RCT-AAAAAAAA', name: 'Ana Souza' }}
      verifyUrl="https://hubcommunity.io/certificado/verificar/RCT-AAAAAAAA"
      qrDataUrl={qrDataUrl}
      server
    />,
  );
  return buffer;
};

// Y offset (inside each slot) of every horizontal stroke `width` pt long — i.e. the
// signature lines. Content streams are Flate-compressed, so inflate them first.
const signatureLineOffsets = (buffer: Buffer, width: number): number[] => {
  const offsets: number[] = [];
  const streams = buffer.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
  for (const [, raw] of streams) {
    let ops: string;
    try {
      ops = inflateSync(Buffer.from(raw, 'latin1')).toString('latin1');
    } catch {
      continue; // not a Flate stream (fonts, images)
    }
    for (const [, x1, y1, x2, y2] of ops.matchAll(/([\d.-]+) ([\d.-]+) m\s+([\d.-]+) ([\d.-]+) l/g)) {
      if (y1 === y2 && Math.abs(Math.abs(Number(x2) - Number(x1)) - width) < 0.5) offsets.push(Number(y1));
    }
  }
  return offsets;
};

describe('CertificateDocument', () => {
  it('renders a PDF with the minimal config', async () => {
    // No background → exercises the default double-line frame path; the participant
    // signature slot is always present, so this also covers a single-slot row.
    const buffer = await render({});
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.toString('latin1')).toMatch(/\/Type \/Pages\n\/Count 1\n/);
  });

  it('renders with background, logo, 8 sponsors and 4 signatures', async () => {
    const buffer = await render({
      title: 'Certificado',
      issuer_name: 'Reactivando',
      primary_color: '#8B5CF6',
      logo: PNG,
      background: PNG,
      sponsors: Array.from({ length: 8 }, (_, i) => ({ name: `S${i}`, logo: PNG })),
      signatures: [
        { name: 'A', role: 'CEO', image: PNG },
        { name: 'B', role: 'CTO' },
        { name: 'C' },
        { name: 'D', role: 'Org', image: PNG },
      ],
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.toString('latin1')).toMatch(/\/Type \/Pages\n\/Count 1\n/);
  });

  it('renders typed cursive signatures in all three fonts', async () => {
    // `server` is set in render(), so the fonts resolve from <cwd>/public/fonts.
    const buffer = await render({
      signatures: [
        { name: 'Ana', role: 'Org', text: 'Ana Souza', font: 'great_vibes' },
        { name: 'Bia', role: 'CTO', text: 'Bia Lima', font: 'allura' },
        { name: 'Caio', text: 'Caio Melo', font: 'dancing_script' },
      ],
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.toString('latin1')).toMatch(/\/Type \/Pages\n\/Count 1\n/);
    const pdf = buffer.toString('latin1');
    // Embedded font dictionaries name the families, so all three must show up.
    expect(pdf).toMatch(/GreatVibes/);
    expect(pdf).toMatch(/Allura/);
    expect(pdf).toMatch(/DancingScript/);
  });

  it('renders a long typed name on one line (stepped-down size)', async () => {
    const buffer = await render({
      signatures: [
        { name: 'Maria', role: 'Org', text: 'Maria Clara de Souza Andrade', font: 'great_vibes' },
        { name: 'B', text: 'Bia Lima Ferreira', font: 'allura' },
        { name: 'C', text: 'Caio', font: 'dancing_script' },
        { name: 'D', text: 'Daniela Rocha Nunes Vieira', font: 'allura' },
      ],
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.toString('latin1')).toMatch(/\/Type \/Pages\n\/Count 1\n/);
  });

  it('prefers the image over typed text and falls back to the default font', async () => {
    const buffer = await render({
      signatures: [
        { name: 'A', image: PNG, text: 'ignored', font: 'allura' },
        { name: 'B', text: 'No font set' },
      ],
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    const pdf = buffer.toString('latin1');
    expect(pdf).toMatch(/GreatVibes/);
    expect(pdf).not.toMatch(/Allura/);
  });

  it('draws every signature line at the same height, whatever fills the slot', async () => {
    // Image, typed cursive text, empty org slot and the participant's blank line must
    // all sit on one baseline; the typed slot used to be 4pt lower than the others.
    const buffer = await render({
      signatures: [
        { name: 'A', role: 'CEO', image: PNG },
        { name: 'B', role: 'CTO', text: 'Bia Lima', font: 'allura' },
        { name: 'C' },
      ],
    });
    const offsets = signatureLineOffsets(buffer, 140);
    expect(offsets).toHaveLength(4);
    expect(new Set(offsets).size).toBe(1);
  });

  it('renders 5 compact slots with 4 org signatures plus the participant', async () => {
    const buffer = await render({
      signatures: [
        { name: 'A', role: 'CEO', image: PNG },
        { name: 'B', role: 'CTO' },
        { name: 'C' },
        { name: 'D', role: 'Org', image: PNG },
      ],
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.toString('latin1')).toMatch(/\/Type \/Pages\n\/Count 1\n/);
  });
}, 30_000);
