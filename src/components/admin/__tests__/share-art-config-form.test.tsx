import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareArtConfigForm } from '@/components/admin/share-art-config-form';
import { UPSERT_SHARE_ART_CONFIG } from '@/lib/queries';
import { defaultPhotoArea, defaultTextArea, type ShareArtConfig } from '@/lib/share-art-config';

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

// REA-45: the crop needs a real canvas; the stub shows what it got and hands back a cropped file.
const croppedFile = new File(['cropped'], 'fundo-feed-1080x1350.jpg', { type: 'image/jpeg' });
vi.mock('@/components/admin/share-art-background-crop-dialog', () => ({
  ShareArtBackgroundCropDialog: ({ imageSrc, format, wrongRatio, onCancel, onCropped }: any) =>
    imageSrc ? (
      <div role="dialog" aria-label="Recorte">
        <span data-testid="crop-src">{imageSrc}</span>
        <span data-testid="crop-format">{format}</span>
        <span data-testid="crop-wrong-ratio">{wrongRatio ? `${wrongRatio.width}x${wrongRatio.height}` : 'none'}</span>
        <button type="button" onClick={() => onCropped(croppedFile)}>Usar recorte</button>
        <button type="button" onClick={onCancel}>Cancelar recorte</button>
      </div>
    ) : null,
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
const storyFormat = (area = AREA): Record<string, unknown> => ({
  __typename: 'ShareArtFormatConfig',
  background: 'https://manager.hubcommunity.io/uploads/story.png',
  background_id: '7',
  background_width: 1080,
  background_height: 1920,
  photo_area: typedArea(area),
  name_text: null,
  role_text: null,
});
const saved = (story: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({
  __typename: 'ShareArtConfig',
  id: 'sa-1',
  story,
  feed: null,
  retired_formats: [],
  roles: null,
  ...extra,
});

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const rounded = <T extends object>(a: T) =>
  Object.fromEntries(Object.entries(a).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v])) as T;

/** What the save sends (REA-47: texts per format and the roles). */
const storyInput = (photo_area: typeof AREA, texts: Record<string, unknown> = {}) => ({
  background: '42',
  photo_area,
  name_text: null,
  role_text: null,
  ...texts,
});
/** REA-49: the roles go with every save; null = every role. */
const input = (story: unknown, roles: string[] | null = null) => ({ story, feed: null, roles });
/** A first background starts with the name and the role under the photo. */
const defaultTexts = (format: 'story' | 'feed') => ({
  name_text: rounded(defaultTextArea(format, 'name')),
  role_text: rounded(defaultTextArea(format, 'role')),
});

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

  it('opens the crop, locked to the format, for a background in another ratio (REA-45)', async () => {
    // A square image: the feed is 4:5 now (REA-47).
    mockImageSize.mockResolvedValue({ width: 2251, height: 2251 });
    renderForm(null);
    await userEvent.click(screen.getByRole('tab', { name: /Feed/ }));
    pickBackground(/Imagem de fundo Feed/, png());

    const dialog = await screen.findByRole('dialog', { name: 'Recorte' });
    expect(dialog).toHaveTextContent('feed');
    expect(screen.getByTestId('crop-wrong-ratio')).toHaveTextContent('2251x2251');
    expect(screen.getByTestId('crop-src')).toHaveTextContent('blob:local-bg');
    expect(screen.queryByText(/precisa ter proporção/)).not.toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Usar recorte' }));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith(croppedFile));
    expect(screen.queryByRole('dialog', { name: 'Recorte' })).not.toBeInTheDocument();
    expect(await screen.findByRole('group', { name: /Área da foto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar arte/ })).toBeEnabled();
  });

  it('uploads nothing when the crop is cancelled', async () => {
    mockImageSize.mockResolvedValue({ width: 2251, height: 2814 });
    renderForm(null);
    pickBackground(/Imagem de fundo Stories/, png());
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar recorte' }));
    expect(screen.queryByRole('dialog', { name: 'Recorte' })).not.toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Salvar arte/ })).toBeDisabled();
  });

  it('refuses, without the crop, an image too small to give 1080 px in the format', async () => {
    mockImageSize.mockResolvedValue({ width: 1080, height: 1350 });
    renderForm(null);
    pickBackground(/Imagem de fundo Stories/, png());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A imagem 1080×1350 é pequena demais para o Stories (9:16): cortada nessa proporção, fica com 759 px de largura, e o fundo precisa de ao menos 1080 px.'
    );
    expect(screen.queryByRole('dialog', { name: 'Recorte' })).not.toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('crops again a background in the right ratio, from the picked original', async () => {
    mockImageSize.mockResolvedValue({ width: 1080, height: 1920 });
    renderForm(null);
    pickBackground(/Imagem de fundo Stories/, png());
    await screen.findByRole('group', { name: /Área da foto/ });
    expect(mockUpload).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /Recortar imagem de fundo/ }));
    expect(screen.getByTestId('crop-src')).toHaveTextContent('blob:local-bg');
    expect(screen.getByTestId('crop-wrong-ratio')).toHaveTextContent('none');
    await userEvent.click(screen.getByRole('button', { name: 'Usar recorte' }));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));
    expect(mockUpload).toHaveBeenLastCalledWith(croppedFile);
  });

  it('crops a saved background through the same-origin proxy', async () => {
    renderForm(saved(storyFormat()) as ShareArtConfig);
    await userEvent.click(screen.getByRole('button', { name: /Recortar imagem de fundo/ }));
    expect(screen.getByTestId('crop-src')).toHaveTextContent(
      `/api/og-image?url=${encodeURIComponent('https://manager.hubcommunity.io/uploads/story.png')}`
    );
  });

  it('uploads a 9:16 background, starts with a centered circle and saves it', async () => {
    mockImageSize.mockResolvedValue({ width: 1080, height: 1920 });
    const area = rounded(defaultPhotoArea('story'));
    const mutation = upsertMock(
      input(storyInput(area, defaultTexts('story'))),
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

  // The config read from the BFF carries __typename (Apollo); the input must not (REA-47 regression).
  it('saves the radius picked on the slider', async () => {
    const mutation = upsertMock(
      input({ ...storyInput({ ...AREA, radius: 0.99 }), background: '7' }),
      saved(storyFormat({ ...AREA, radius: 0.99 }))
    );
    renderForm(saved(storyFormat()) as ShareArtConfig, [mutation]);
    const slider = screen.getByRole('slider', { name: /Arredondamento/ });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() => expect(mutation.newData).toHaveBeenCalled());
  });

  it('goes back to the default art for a format', async () => {
    const mutation = upsertMock(input(null), saved(null));
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
          variables: { eventId: 'ev-1', data: input(storyInput(area, defaultTexts('story'))) },
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

// ─── REA-47: name, role, roles per product and the 4:5 feed ──────────────────────────────

describe('ShareArtConfigForm — name and role (REA-47)', () => {
  const NAME = {
    __typename: 'ShareArtText', x: 0.1, y: 0.7, width: 0.8, height: 0.05,
    font: 'inter_bold', size: 0.06, color: '#ffffff', align: 'center',
  };
  const withName = () => ({ ...storyFormat(), name_text: NAME });
  const plain = ({ __typename, ...rest }: typeof NAME) => rest;

  it('a first background starts with the name and the role under the photo', async () => {
    mockImageSize.mockResolvedValue({ width: 1080, height: 1920 });
    renderForm(null);
    pickBackground(/Imagem de fundo Stories/, png());
    expect(await screen.findByRole('group', { name: /Área do nome/ })).toHaveTextContent('Maria Silva');
    expect(screen.getByRole('group', { name: /Área do papel/ })).toHaveTextContent('Participante');
  });

  it('picks the name to edit, changes its color and alignment and saves them', async () => {
    const mutation = upsertMock(
      input({
        ...storyInput(AREA),
        background: '7',
        name_text: { ...plain(NAME), color: '#112233', align: 'left' },
      }),
      saved(withName())
    );
    renderForm(saved(withName()) as ShareArtConfig, [mutation]);
    await userEvent.click(screen.getByRole('radio', { name: 'Nome' }));
    expect(screen.getByRole('switch', { name: /Mostrar o nome na arte/ })).toBeChecked();
    fireEvent.input(screen.getByLabelText('Cor do nome'), { target: { value: '#112233' } });
    await userEvent.click(screen.getByRole('radio', { name: 'Alinhar à esquerda' }));
    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() => expect(mutation.newData).toHaveBeenCalled());
  });

  it('takes the name off the art', async () => {
    const mutation = upsertMock(input({ ...storyInput(AREA), background: '7' }), saved(storyFormat()));
    renderForm(saved(withName()) as ShareArtConfig, [mutation]);
    await userEvent.click(screen.getByRole('radio', { name: 'Nome' }));
    await userEvent.click(screen.getByRole('switch', { name: /Mostrar o nome na arte/ }));
    expect(screen.queryByRole('group', { name: /Área do nome/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() => expect(mutation.newData).toHaveBeenCalled());
  });

  it('turns the role on with its default place', async () => {
    renderForm(saved(storyFormat()) as ShareArtConfig);
    await userEvent.click(screen.getByRole('radio', { name: 'Papel' }));
    await userEvent.click(screen.getByRole('switch', { name: /Mostrar o papel na arte/ }));
    expect(screen.getByRole('group', { name: /Área do papel/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar arte/ })).toBeEnabled();
  });
});

it('has no role per product: the role is what the person picks in the generator (REA-47)', () => {
  renderForm(saved(storyFormat()) as ShareArtConfig);
  expect(screen.queryByText('Papel na arte')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Papel padrão')).not.toBeInTheDocument();
});

describe('ShareArtConfigForm — the feed is 4:5 (REA-47)', () => {
  it('tells that an old 1:1 feed background no longer counts', async () => {
    renderForm(saved(storyFormat(), { retired_formats: ['feed'] }) as ShareArtConfig);
    await userEvent.click(screen.getByRole('tab', { name: /Feed/ }));
    expect(screen.getByTestId('retired-feed')).toHaveTextContent('o Feed agora é 4:5 (1080×1350)');
  });
});

// ─── REA-49: roles offered in the generator ──────────────────────────────────────────────

describe('ShareArtConfigForm — roles offered in the generator (REA-49)', () => {
  const ROLE = {
    __typename: 'ShareArtText', x: 0.1, y: 0.78, width: 0.8, height: 0.04,
    font: 'inter', size: 0.04, color: '#ffffff', align: 'center',
  };
  const withRole = () => ({ ...storyFormat(), role_text: ROLE });
  const roleBox = (role: string) => screen.getByRole('checkbox', { name: role });
  const ORDER = ['Participante', 'Líder', 'Mentor', 'Voluntário', 'Palestrante', 'Organizador'];

  it('marks every role, in the usual order, when nothing is configured', () => {
    renderForm(null);
    const group = screen.getByRole('group', { name: 'Papéis oferecidos no gerador' });
    expect(Array.from(group.querySelectorAll('label')).map(l => l.textContent)).toEqual(ORDER);
    ORDER.forEach(role => expect(roleBox(role)).toBeChecked());
  });

  it('shows the saved choice', () => {
    renderForm(saved(storyFormat(), { roles: ['Mentor', 'Palestrante'] }) as ShareArtConfig);
    expect(roleBox('Mentor')).toBeChecked();
    expect(roleBox('Palestrante')).toBeChecked();
    expect(roleBox('Participante')).not.toBeChecked();
  });

  it('saves the marked roles in the usual order', async () => {
    const mutation = upsertMock(
      input({ ...storyInput(AREA), background: '7' }, ['Mentor', 'Organizador']),
      saved(storyFormat(), { roles: ['Mentor', 'Organizador'] })
    );
    renderForm(saved(storyFormat()) as ShareArtConfig, [mutation]);
    for (const role of ['Organizador', 'Participante', 'Líder', 'Voluntário', 'Palestrante']) {
      // eslint-disable-next-line no-await-in-loop
      await userEvent.click(roleBox(role));
    }
    await userEvent.click(roleBox('Organizador'));
    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() => expect(mutation.newData).toHaveBeenCalled());
  });

  it('saves null when every role is marked again', async () => {
    const mutation = upsertMock(input({ ...storyInput(AREA), background: '7' }, null), saved(storyFormat()));
    renderForm(saved(storyFormat(), { roles: ORDER.slice(0, 5) }) as ShareArtConfig, [mutation]);
    await userEvent.click(roleBox('Organizador'));
    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() => expect(mutation.newData).toHaveBeenCalled());
  });

  it('keeps the last role marked while the role text is on the art', async () => {
    renderForm(saved(withRole(), { roles: ['Mentor', 'Líder'] }) as ShareArtConfig);
    await userEvent.click(roleBox('Mentor'));
    expect(roleBox('Líder')).toBeChecked();
    expect(roleBox('Líder')).toBeDisabled();
    expect(screen.getByText(/pelo menos um papel fica marcado/)).toBeInTheDocument();
    // The preview shows the first offered role.
    expect(screen.getByRole('group', { name: /Área do papel/ })).toHaveTextContent('Líder');
  });

  it('lets every role be unmarked when the role text is not on the art', async () => {
    const mutation = upsertMock(input({ ...storyInput(AREA), background: '7' }, []), saved(storyFormat()));
    renderForm(saved(storyFormat(), { roles: ['Mentor'] }) as ShareArtConfig, [mutation]);
    expect(roleBox('Mentor')).toBeEnabled();
    await userEvent.click(roleBox('Mentor'));
    await userEvent.click(screen.getByRole('button', { name: /Salvar arte/ }));
    await waitFor(() => expect(mutation.newData).toHaveBeenCalled());
  });

  it('does not save the role text on the art with no role marked', async () => {
    renderForm(saved(storyFormat(), { roles: [] }) as ShareArtConfig);
    await userEvent.click(screen.getByRole('radio', { name: 'Papel' }));
    await userEvent.click(screen.getByRole('switch', { name: /Mostrar o papel na arte/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Marque pelo menos um papel');
    expect(screen.getByRole('button', { name: /Salvar arte/ })).toBeDisabled();
    await userEvent.click(roleBox('Palestrante'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar arte/ })).toBeEnabled();
  });

  it('discards the role changes with the rest', async () => {
    renderForm(saved(withRole()) as ShareArtConfig);
    await userEvent.click(roleBox('Mentor'));
    await userEvent.click(screen.getByRole('button', { name: /Descartar/ }));
    expect(roleBox('Mentor')).toBeChecked();
    expect(screen.getByRole('button', { name: /Salvar arte/ })).toBeDisabled();
  });
});
