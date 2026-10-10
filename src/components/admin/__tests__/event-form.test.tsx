import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { UploadError } from '@/lib/upload';
import { EventForm } from '../event-form';

const toast = vi.fn();
const uploadFiles = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: () => null,
}));
vi.mock('@/lib/upload', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/upload')>()),
  uploadFiles: (...files: File[]) => uploadFiles(...files),
}));
// Cropping needs a real canvas; the stub hands back the cropped file at once.
vi.mock('@/components/admin/image-crop-dialog', () => ({
  ImageCropDialog: ({
    onCropComplete,
  }: {
    onCropComplete: (f: File, url: string) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onCropComplete(
          new File(['x'], 'cover.jpg', { type: 'image/jpeg' }),
          'blob:cover'
        )
      }
    >
      Confirmar recorte
    </button>
  ),
}));

const initialData = {
  title: 'Meetup',
  slug: 'meetup',
  start_date: '2026-11-01T10:00',
  end_date: '2026-11-01T12:00',
  max_slots: 10,
  talks: [],
  products: [],
};

async function renderWithCover(onSubmit = vi.fn(), onSaved = vi.fn()) {
  const { container } = render(
    <MockedProvider mocks={[]} addTypename={false}>
      <EventForm
        initialData={initialData}
        onSubmit={onSubmit}
        onSaved={onSaved}
      />
    </MockedProvider>
  );
  const input = container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(['raw'], 'foto.png', { type: 'image/png' })] },
  });
  fireEvent.click(await screen.findByText('Confirmar recorte'));
  return { onSubmit, onSaved };
}

beforeEach(() => vi.clearAllMocks());

describe('EventForm cover upload', () => {
  it('saves the event with the uploaded cover id and reports the saved id', async () => {
    uploadFiles.mockResolvedValue(['42']);
    const { onSubmit, onSaved } = await renderWithCover(
      vi.fn().mockResolvedValue('evt-1')
    );

    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('evt-1'));
    expect(onSubmit.mock.calls[0][0].images).toEqual(['42']);
  });

  it('shows the upload error and does not save the event', async () => {
    uploadFiles.mockRejectedValue(
      new UploadError(
        'A imagem é grande demais para o servidor aceitar. Use uma imagem menor.',
        413
      )
    );
    const { onSubmit, onSaved } = await renderWithCover();

    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/grande demais/);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'Erro no upload da capa',
      })
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not report a save when the event could not be saved', async () => {
    uploadFiles.mockResolvedValue(['42']);
    const { onSubmit, onSaved } = await renderWithCover(
      vi.fn().mockResolvedValue(undefined)
    );

    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
  });
});
