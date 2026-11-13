import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareArtGenerator } from '@/components/share-art/share-art-generator';
import type { ShareArtConfig } from '@/lib/share-art-config';

// The cover, the logo and the custom background are fetched as data URLs (same-origin pixels).
const mockImageToDataUrl = vi.fn();
vi.mock('@/lib/share-art-image', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/share-art-image')>()),
  imageToDataUrl: (url: string) => mockImageToDataUrl(url),
}));

const EVENT = { slug: 'sw-goiania', title: 'Startup Weekend Goiânia', images: [] };
const AREA = { x: 0.1, y: 0.2, width: 0.8, height: 0.45, radius: 1 };
const CONFIG: ShareArtConfig = {
  id: 'sa-1',
  story: {
    background: 'https://manager.hubcommunity.io/uploads/story.png',
    background_id: '7',
    photo_area: AREA,
  },
  feed: null,
};

beforeEach(() => {
  mockImageToDataUrl.mockReset().mockImplementation(async (url: string) =>
    url.includes('story.png') ? 'data:image/png;base64,BG' : null
  );
});

describe('ShareArtGenerator', () => {
  it('without a custom art, keeps the default template with role and name', async () => {
    render(<ShareArtGenerator event={EVENT} defaultName="Ana" />);
    expect(screen.getByText('Seu papel no evento')).toBeInTheDocument();
    expect(screen.getByText('Seu nome')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Prévia da sua arte' })).not.toBeInTheDocument();
  });

  it('says "Me inscrevi" to a signup and "Eu vou" to everyone else (REA-45)', () => {
    const { unmount } = render(<ShareArtGenerator event={EVENT} />);
    expect(screen.getAllByText('Me inscrevi no').length).toBeGreaterThan(0);
    unmount();
    render(<ShareArtGenerator event={EVENT} signedUp={false} />);
    expect(screen.queryByText('Me inscrevi no')).not.toBeInTheDocument();
    expect(screen.getAllByText('Eu vou no').length).toBeGreaterThan(0);
  });

  it("uses the event's art on the configured format: background through the same-origin proxy", async () => {
    render(<ShareArtGenerator event={EVENT} defaultName="Ana" customConfig={CONFIG} />);
    expect(await screen.findByRole('img', { name: 'Prévia da sua arte' })).toBeInTheDocument();
    expect(mockImageToDataUrl).toHaveBeenCalledWith(
      `/api/og-image?url=${encodeURIComponent(CONFIG.story!.background)}`
    );
    // Role and name are not part of the organizer's art.
    expect(screen.queryByText('Seu papel no evento')).not.toBeInTheDocument();
    expect(screen.getByText(/Este formato usa a arte do evento/)).toBeInTheDocument();
  });

  it('keeps the default art on a format the organizer did not configure', async () => {
    render(<ShareArtGenerator event={EVENT} customConfig={CONFIG} />);
    await screen.findByRole('img', { name: 'Prévia da sua arte' });
    await userEvent.click(screen.getByRole('button', { name: /Feed \(4:5\)/ }));
    expect(screen.queryByRole('img', { name: 'Prévia da sua arte' })).not.toBeInTheDocument();
    expect(screen.getByText('Seu papel no evento')).toBeInTheDocument();
  });

  it('keeps the default art when the background cannot be loaded', async () => {
    mockImageToDataUrl.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<ShareArtGenerator event={EVENT} customConfig={CONFIG} />);
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByText('Seu papel no evento')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Prévia da sua arte' })).not.toBeInTheDocument();
    warn.mockRestore();
  });
});

// ─── REA-47: name and role on the organizer's art ────────────────────────────────────────
describe("ShareArtGenerator — name and role on the organizer's art (REA-47)", () => {
  const TEXT = {
    x: 0.1, y: 0.7, width: 0.8, height: 0.05, font: 'inter_bold' as const, size: 0.05, color: '#ffffff', align: 'center' as const,
  };
  const WITH_TEXTS: ShareArtConfig = {
    ...CONFIG,
    story: { ...CONFIG.story!, name_text: TEXT, role_text: { ...TEXT, y: 0.77 } },
  };

  it('asks the role and the name, as on the default art, to draw them where the organizer placed them', async () => {
    render(<ShareArtGenerator event={EVENT} defaultName="Ana" customConfig={WITH_TEXTS} />);
    await screen.findByRole('img', { name: 'Prévia da sua arte' });
    expect(screen.getByText('Seu papel no evento')).toBeInTheDocument();
    for (const role of ['Participante', 'Líder', 'Mentor', 'Voluntário', 'Palestrante', 'Organizador']) {
      expect(screen.getByRole('button', { name: role })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: 'Mentor' }));
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toHaveValue('Ana');
  });

  it('asks only what the organizer placed', async () => {
    const onlyName: ShareArtConfig = { ...CONFIG, story: { ...CONFIG.story!, name_text: TEXT } };
    render(<ShareArtGenerator event={EVENT} customConfig={onlyName} />);
    await screen.findByRole('img', { name: 'Prévia da sua arte' });
    expect(screen.queryByText('Seu papel no evento')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toBeInTheDocument();
  });

  it('asks nothing when the organizer did not place the name nor the role', async () => {
    render(<ShareArtGenerator event={EVENT} customConfig={CONFIG} />);
    await screen.findByRole('img', { name: 'Prévia da sua arte' });
    expect(screen.queryByRole('textbox', { name: 'Seu nome' })).not.toBeInTheDocument();
    expect(screen.queryByText('Seu papel no evento')).not.toBeInTheDocument();
  });

  it('shows the feed as 4:5', () => {
    render(<ShareArtGenerator event={EVENT} />);
    expect(screen.getByRole('button', { name: /Feed \(4:5\)/ })).toBeInTheDocument();
  });
});

// ─── REA-49: roles offered by the organizer ──────────────────────────────────────────────
describe('ShareArtGenerator — roles offered by the organizer (REA-49)', () => {
  const TEXT = {
    x: 0.1, y: 0.77, width: 0.8, height: 0.05, font: 'inter_bold' as const, size: 0.05, color: '#ffffff', align: 'center' as const,
  };
  const roleButtons = () =>
    screen.getAllByRole('button').filter(b => b.closest('section')?.textContent?.includes('Seu papel no evento'));

  it('offers every role, in the usual order, without configuration', () => {
    render(<ShareArtGenerator event={EVENT} customConfig={{ ...CONFIG, story: null, roles: null }} />);
    expect(roleButtons().map(b => b.textContent)).toEqual([
      'Participante', 'Líder', 'Mentor', 'Voluntário', 'Palestrante', 'Organizador',
    ]);
  });

  it('offers only the marked roles, in the usual order, and picks the first one', () => {
    render(
      <ShareArtGenerator event={EVENT} customConfig={{ ...CONFIG, story: null, roles: ['Organizador', 'Mentor'] }} />
    );
    expect(roleButtons().map(b => b.textContent)).toEqual(['Mentor', 'Organizador']);
    expect(screen.getByRole('button', { name: 'Mentor' })).toHaveAttribute('aria-pressed', 'true');
    // The default art shows the picked role.
    expect(screen.getAllByText('Mentor').length).toBeGreaterThan(1);
  });

  it('with a single role, picks it alone and hides the step (default art)', () => {
    render(<ShareArtGenerator event={EVENT} customConfig={{ ...CONFIG, story: null, roles: ['Palestrante'] }} />);
    expect(screen.queryByText('Seu papel no evento')).not.toBeInTheDocument();
    expect(screen.getAllByText('Palestrante').length).toBeGreaterThan(0);
    // The name becomes step 3.
    expect(screen.getByRole('heading', { name: /Seu nome/ })).toHaveTextContent('3Seu nome');
  });

  it("with a single role, hides the step on the organizer's art too", async () => {
    const config: ShareArtConfig = {
      ...CONFIG,
      story: { ...CONFIG.story!, role_text: TEXT, name_text: { ...TEXT, y: 0.7 } },
      roles: ['Voluntário'],
    };
    render(<ShareArtGenerator event={EVENT} customConfig={config} />);
    await screen.findByRole('img', { name: 'Prévia da sua arte' });
    expect(screen.queryByText('Seu papel no evento')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Seu nome' })).toBeInTheDocument();
  });

  it('offers every role when the list is empty (the role text is not on the art)', () => {
    render(<ShareArtGenerator event={EVENT} customConfig={{ ...CONFIG, story: null, roles: [] }} />);
    expect(roleButtons()).toHaveLength(6);
  });
});
