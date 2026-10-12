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

describe('EventForm: section by URL and unsaved changes (REA-24)', () => {
  const saved = { ...initialData, id: 'evt-1' };
  const renderForm = (props: Partial<React.ComponentProps<typeof EventForm>> = {}) => {
    const onSubmit = vi.fn().mockResolvedValue('evt-1');
    const onDirtyChange = vi.fn();
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EventForm initialData={saved} onSubmit={onSubmit} onDirtyChange={onDirtyChange} {...props} />
      </MockedProvider>
    );
    return { onSubmit, onDirtyChange };
  };
  const lastDirty = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)?.[0];

  it('without a section keeps its own tabs (new event)', () => {
    renderForm();
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Geral', 'Programação', 'Produtos & Lotes',
    ]);
  });

  it('with a section shows that part only, without the tab list (the sidebar is it)', () => {
    renderForm({ section: 'schedule' });
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText('Palestras (Talks)')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Meetup')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar Evento/ })).toBeInTheDocument();
  });

  it('asks for the section with the error instead of switching by itself', async () => {
    const onSectionChange = vi.fn();
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EventForm initialData={{ ...saved, title: '' }} onSubmit={vi.fn()} section="schedule" onSectionChange={onSectionChange} />
      </MockedProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));
    await waitFor(() => expect(onSectionChange).toHaveBeenCalledWith('general'));
  });

  it('starts clean, reports an edit as unsaved and a save as clean again', async () => {
    const { onSubmit, onDirtyChange } = renderForm({ section: 'general' });
    expect(lastDirty(onDirtyChange)).toBe(false);
    expect(screen.queryByText('Há alterações não salvas.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Meetup'), { target: { value: 'Meetup 2' } });
    await waitFor(() => expect(lastDirty(onDirtyChange)).toBe(true));
    expect(screen.getByText('Há alterações não salvas.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await waitFor(() => expect(lastDirty(onDirtyChange)).toBe(false));
    expect(screen.queryByText('Há alterações não salvas.')).not.toBeInTheDocument();
  });

  it('keeps the changes marked when the save fails', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { onDirtyChange } = renderForm({ section: 'general', onSubmit });
    fireEvent.change(screen.getByDisplayValue('Meetup'), { target: { value: 'Meetup 2' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(lastDirty(onDirtyChange)).toBe(true);
  });
});

describe('EventForm: lote pago exige conta Opa Pingou (REA-12)', () => {
  const KEY = `opk_live_${'k'.repeat(43)}`;
  const paidProducts = [
    { id: 'p1', name: 'Ingresso', enabled: true, batches: [{ batch_number: 1, value: 25, enabled: true }] },
  ];

  const renderNew = (products: any[], onSubmit = vi.fn().mockResolvedValue('evt-1')) => {
    render(
      <MockedProvider mocks={[]} addTypename={false}>
        <EventForm initialData={{ ...initialData, products }} onSubmit={onSubmit} />
      </MockedProvider>
    );
    return onSubmit;
  };

  const openProductsTab = () =>
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Produtos & Lotes' }), { button: 0, ctrlKey: false });

  it('evento novo com lote pago e sem chave: não salva e explica', async () => {
    const onSubmit = renderNew(paidProducts);
    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Falta a conta Opa Pingou' }))
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('evento novo com lote pago e chave: salva levando a chave para conectar depois de criar', async () => {
    const onSubmit = renderNew(paidProducts);
    openProductsTab();
    fireEvent.change(await screen.findByLabelText('Chave de API do Opa Pingou'), { target: { value: ` ${KEY} ` } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].opaPingouApiKey).toBe(KEY);
  });

  it('evento novo só com lote gratuito: salva sem chave', async () => {
    const onSubmit = renderNew([{ id: 'p1', name: 'Grátis', enabled: true, batches: [{ batch_number: 1, value: 0, enabled: true }] }]);
    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].opaPingouApiKey).toBeUndefined();
  });

  it('chave incompleta: não salva', async () => {
    const onSubmit = renderNew([]);
    openProductsTab();
    fireEvent.change(await screen.findByLabelText('Chave de API do Opa Pingou'), { target: { value: 'opk_live_abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Evento/ }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Chave do Opa Pingou incompleta' }))
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
