import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareArtConfigForm } from '@/components/admin/share-art-config-form';
import { UPSERT_SHARE_ART_CONFIG } from '@/lib/queries';
import { defaultPhotoArea, type ShareArtConfig } from '@/lib/share-art-config';

// ─── Mocks ────────────────────────────────────────────────────────

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

const mockUpload = vi.fn();
vi.mock('@/lib/upload', () => ({ uploadFiles: (...files: File[]) => mockUpload(...files) }));

// jsdom does not decode images: the size of the picked file comes from here.
const mockImageSize = vi.fn();
vi.mock('@/lib/share-art-custom', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/share-art-custom')>()),
  readImageSize: (file: File) => mockImageSize(file),
}));

beforeEach(() => {
  mockToast.mockReset();
  mockUpload.mockReset().mockResolvedValue(['42']);
  mockImageSize.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:local-bg');
  URL.revokeObjectURL = vi.fn();
});

// ─── Fixtures ─────────────────────────────────────────────────────

const AREA = { x: 0.1, y: 0.2, width: 0.8, height: 0.45, radius: 1 };
const typedArea = (area: typeof AREA) => ({ __typename: 'ShareArtPhotoArea', ...area });
const storyFormat = (area = AREA) => ({
  __typename: 'ShareArtFormatConfig',
  background: 'https://manager.hubcommunity.io/uploads/story.png',
  background_id: '7',
  background_width: 1080,
  background_height: 1920,
  photo_area: typedArea(area),
});
const saved = (story: ReturnType<typeof storyFormat> | null) => ({
  __typename: 'ShareArtConfig',
  id: 'sa-1',
  story,
  feed: null,
});

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const rounded = (a: typeof AREA) =>
  Object.fromEntries(Object.entries(a).map(([k, v]) => [k, round(v)])) as typeof AREA;

const upsertMock = (data: unknown, result: ReturnType<typeof saved>): MockedResponse & { newData: ReturnType<typeof vi.fn> } => {
  const newData = vi.fn(() => ({ data: { upsertShareArtConfig: result } }));
  return {
    request: { query: UPSERT_SHARE_ART_CONFIG, variables: { eventId: 'ev-1', data } },
    newData,
  };
};

const renderForm = (initialConfig: ShareArtConfig | null, mocks: MockedResponse[] = []) => {
  const onSaved = vi.fn();
  render(
    <MockedProvider mocks={mocks}>
      <ShareArtConfigForm eventId="ev-1" initialConfig={initialConfig} onSaved={onSaved} />
    </MockedProvider>
  );
  return { onSaved };
};

const pickBackground = (label: RegExp, file: File) =>
  fireEvent.change(screen.getByLabelText(label), { target: { files: [file] } });

const png = (name = 'fundo.png') => new File(['x'], name, { type: 'image/png' });

// ─── Tests ────────────────────────────────────────────────────────

describe('ShareArtConfigForm', () => {
  it('starts on the default art, with nothing to save', () => {
    renderForm(null);
    expect(screen.getByText(/Sem imagem de fundo: os participantes geram a arte padrão/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar arte/ })).toBeDisabled();
  });

  it('refuses a background with the wrong ratio before uploading it', async () => {
    mockImageSize.mockResolvedValue({ width: 1080, height: 1350 });
    renderForm(null);
    pickBackground(/Imagem de fundo Stories/, png());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O fundo do Stories (9:16) precisa ter proporção 9:16 (a enviada tem 1080×1350).'
    );
    expect(mockUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Salvar arte/ })).toBeDisabled();
  });

  it('uploads a 9:16 background, starts with a centered circle and saves it', async () => {
    mockImageSize.mockResolvedValue({ width: 1080, height: 1920 });
    const area = rounded(defaultPhotoArea('story'));
    const mutation = upsertMock(
      { story: { background: '42', photo_area: area }, feed: null },
      saved(storyFormat(area))
    );
    const { onSaved } = renderForm(null, [mutation]);

    pickBackground(/Imagem de fundo Stories/, png());
    expect(await screen.findByRole('group', { name: /Área da foto/ })).toBeInTheDocument();
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('img', { name: /Prévia da arte Stories/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() => expect(mutation.newData).toHaveBeenCalled());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'sa-1' })));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Arte salva' }));
  });

  it('saves the radius picked on the slider', async () => {
    const mutation = upsertMock(
      { story: { background: '7', photo_area: { ...AREA, radius: 0.99 } }, feed: null },
      saved(storyFormat({ ...AREA, radius: 0.99 }))
    );
    renderForm(saved(storyFormat()) as ShareArtConfig, [mutation]);
    const slider = screen.getByRole('slider', { name: /Arredondamento/ });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() => expect(mutation.newData).toHaveBeenCalled());
  });

  it('goes back to the default art for a format', async () => {
    const mutation = upsertMock({ story: null, feed: null }, saved(null));
    renderForm(saved(storyFormat()) as ShareArtConfig, [mutation]);
    await userEvent.click(screen.getByRole('button', { name: /Usar a arte padrão/ }));
    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() => expect(mutation.newData).toHaveBeenCalled());
  });

  it('shows the error of the BFF when the save is refused', async () => {
    mockImageSize.mockResolvedValue({ width: 1080, height: 1920 });
    const area = rounded(defaultPhotoArea('story'));
    renderForm(null, [
      {
        request: {
          query: UPSERT_SHARE_ART_CONFIG,
          variables: { eventId: 'ev-1', data: { story: { background: '42', photo_area: area }, feed: null } },
        },
        result: { errors: [{ message: 'Apenas organizadores do evento podem fazer esta operação.' } as never] },
      },
    ]);
    pickBackground(/Imagem de fundo Stories/, png());
    await screen.findByRole('group', { name: /Área da foto/ });
    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'Apenas organizadores do evento podem fazer esta operação.',
        })
      )
    );
  });
});
