import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import { ProductsBreakdownCard } from '../products-breakdown-card';
import type { ProductAnalytics } from '@/lib/types';

const text = (el: HTMLElement) => (el.textContent || '').replace(/ /g, ' ');

const firstBatch: ProductAnalytics = {
  product_id: 'p1',
  product_name: 'Primeiro Lote',
  total_signups: 1,
  batches: [
    { batch_id: 'b1', batch_number: 1, value: 1990, max_quantity: 100, sold_quantity: 1, revenue: 1990 },
  ],
};

describe('ProductsBreakdownCard', () => {
  it('shows the R$ 19,90 batch as R$ 19,90, not R$ 1.990,00 (REA-17)', () => {
    render(<ProductsBreakdownCard products={[firstBatch]} />);
    const product = screen.getByRole('region', { name: 'Primeiro Lote' });

    expect(text(product)).toContain('R$ 19,90');
    expect(text(product)).not.toContain('1.990');
    expect(text(product)).toContain('1 de 100 vendido');
    expect(text(product)).toContain('1%');
  });

  it('does not repeat the totals in the header of a single-batch product', () => {
    render(<ProductsBreakdownCard products={[firstBatch]} />);
    const product = screen.getByRole('region', { name: 'Primeiro Lote' });
    expect(text(product)).not.toContain('inscrição');
  });

  it('sums a multi-batch product in the header', () => {
    render(
      <ProductsBreakdownCard
        products={[
          {
            ...firstBatch,
            total_signups: 3,
            batches: [
              ...firstBatch.batches,
              { batch_id: 'b2', batch_number: 2, value: 2990, max_quantity: 0, sold_quantity: 2, revenue: 5980 },
            ],
          },
        ]}
      />,
    );
    const header = within(screen.getByRole('region', { name: 'Primeiro Lote' })).getByText(/inscrições/);
    expect(text(header)).toBe('3 inscrições · R$ 79,70');
    expect(screen.getByText('sem limite')).toBeTruthy();
  });

  it('renders nothing without products', () => {
    const { container } = render(<ProductsBreakdownCard products={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
