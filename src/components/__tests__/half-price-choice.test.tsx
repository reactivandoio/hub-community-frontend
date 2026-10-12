import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HalfPriceChoice } from '../half-price-choice';

describe('HalfPriceChoice', () => {
  it('reports the checkbox choice', () => {
    const onChange = vi.fn();
    render(<HalfPriceChoice checked={false} onCheckedChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Quero meia-entrada'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('opens the trust explanation from the keyboard', async () => {
    const user = userEvent.setup();
    render(<HalfPriceChoice checked={false} onCheckedChange={vi.fn()} />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Como funciona a meia-entrada' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/livre e espontânea vontade/)).toBeInTheDocument();
    expect(screen.getByText('Não pedimos documento nem comprovante.')).toBeInTheDocument();
  });
});
