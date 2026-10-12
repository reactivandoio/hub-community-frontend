import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminEmpty, AdminPage, AdminPageError, AdminPageHeader, AdminPageLoading } from '../admin-page';

describe('AdminPage (REA-24 standard page frame)', () => {
  it('takes the whole width, with no centered container or max width', () => {
    render(<AdminPage>conteúdo</AdminPage>);
    const frame = screen.getByText('conteúdo');
    expect(frame).toHaveClass('w-full', 'px-4');
    expect(frame.className).not.toMatch(/container|mx-auto|max-w-/);
  });

  it('header: one h1, the description and the actions of the page', () => {
    render(
      <AdminPageHeader
        title="Eventos"
        description="Crie e edite os eventos."
        actions={<button type="button">Novo Evento</button>}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Eventos');
    expect(screen.getByText('Crie e edite os eventos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo Evento' })).toBeInTheDocument();
    // No way back in the header: that is the breadcrumb's and the sidebar's job.
    expect(screen.queryByRole('button', { name: /voltar/i })).not.toBeInTheDocument();
  });

  it('loading: a named skeleton, in the same frame as the page', () => {
    render(<AdminPageLoading label="Carregando eventos" />);
    expect(screen.getByRole('status', { name: 'Carregando eventos' })).toHaveClass('w-full', 'px-4');
  });

  it('error: title, message and an optional way out', () => {
    const onClick = vi.fn();
    render(
      <AdminPageError
        title="Erro ao carregar evento"
        message="Sem conexão"
        action={{ label: 'Voltar para os eventos', onClick }}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Erro ao carregar evento');
    expect(alert).toHaveTextContent('Sem conexão');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para os eventos' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('empty: the text of the block', () => {
    render(<AdminEmpty>Nenhum cupom.</AdminEmpty>);
    expect(screen.getByText('Nenhum cupom.')).toBeInTheDocument();
  });
});
