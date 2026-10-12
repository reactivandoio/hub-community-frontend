import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CouponsTab } from '../coupons-tab';
import { CREATE_COUPON, EVENT_COUPONS, UPDATE_COUPON } from '@/lib/queries';
import type { Coupon, Product } from '@/lib/types';

const products: Product[] = [
  {
    id: 'p1',
    name: 'Ingresso',
    enabled: true,
    batches: [
      { id: 'b1', batch_number: 1, value: 5000, valid_from: '', valid_until: '', enabled: true, half_price_eligible: false },
      { id: 'b2', batch_number: 2, value: 7000, valid_from: '', valid_until: '', enabled: true, half_price_eligible: false },
    ],
  },
];

const coupon = (extra: Partial<Coupon> = {}): Coupon => ({
  id: 'c1',
  code: 'PROMO10',
  discount_type: 'percentage',
  discount_percentage: 10,
  discount_value_cents: null,
  starts_at: null,
  expires_at: null,
  max_uses: 50,
  uses: 0,
  enabled: true,
  batches: [],
  ...extra,
});

const listMock = (coupons: Coupon[]): MockedResponse => ({
  request: { query: EVENT_COUPONS, variables: { eventId: 'ev1' } },
  result: { data: { eventCoupons: coupons } },
});

const renderTab = (mocks: MockedResponse[]) =>
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <CouponsTab eventId="ev1" products={products} />
    </MockedProvider>,
  );

describe('CouponsTab', () => {
  it('lists coupons with value, uses against the limit, batches and status', async () => {
    renderTab([
      listMock([
        coupon({ uses: 3 }),
        coupon({
          id: 'c2',
          code: 'MENOS20',
          discount_type: 'fixed',
          discount_percentage: null,
          discount_value_cents: 2000,
          max_uses: null,
          enabled: false,
          batches: [{ id: 'b2', batch_number: 2 }],
        }),
      ]),
    ]);
    const row1 = (await screen.findByText('PROMO10')).closest('tr')!;
    expect(within(row1).getByText('10%')).toBeInTheDocument();
    expect(within(row1).getByText('3 / 50')).toBeInTheDocument();
    expect(within(row1).getByText('Todos')).toBeInTheDocument();
    expect(within(row1).getByText('Período do lote')).toBeInTheDocument();
    const row2 = screen.getByText('MENOS20').closest('tr')!;
    expect(within(row2).getByText('R$ 20,00')).toBeInTheDocument();
    expect(within(row2).getByText('0 / ilimitado')).toBeInTheDocument();
    expect(within(row2).getByText('Ingresso — Lote 2')).toBeInTheDocument();
    expect(within(row2).getByText('Inativo')).toBeInTheDocument();
  });

  it('creates a fixed coupon typed in reais and sends cents', async () => {
    const created = coupon({ id: 'c9', code: 'VIP', discount_type: 'fixed', discount_percentage: null, discount_value_cents: 1550, max_uses: null, batches: [{ id: 'b1', batch_number: 1 }] });
    renderTab([
      listMock([]),
      {
        request: {
          query: CREATE_COUPON,
          variables: {
            data: {
              code: 'VIP',
              event: 'ev1',
              starts_at: null,
              expires_at: null,
              max_uses: null,
              enabled: true,
              batches: ['b1'],
              discount_type: 'fixed',
              discount_percentage: null,
              discount_value_cents: 1550,
            },
          },
        },
        result: { data: { createCoupon: created } },
      },
      listMock([created]),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: /Novo cupom/ }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'vip' } });
    fireEvent.click(screen.getByLabelText('Valor fixo'));
    fireEvent.change(screen.getByLabelText('Desconto (R$)'), { target: { value: '15,50' } });
    fireEvent.click(screen.getByLabelText('Ingresso — Lote 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cupom' }));
    expect(await screen.findByText('VIP')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('validates before calling the server', async () => {
    renderTab([listMock([])]);
    fireEvent.click(await screen.findByRole('button', { name: /Novo cupom/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cupom' }));
    expect(await screen.findByText('Informe o código.')).toBeInTheDocument();
    expect(screen.getByText('Use um percentual inteiro de 1 a 100.')).toBeInTheDocument();
  });

  it('locks type and value of a used coupon and leaves them out of the update', async () => {
    const used = coupon({ uses: 2 });
    renderTab([
      listMock([used]),
      {
        request: {
          query: UPDATE_COUPON,
          variables: {
            id: 'c1',
            data: { code: 'PROMO10', event: 'ev1', starts_at: null, expires_at: null, max_uses: 50, enabled: false, batches: [] },
          },
        },
        result: { data: { updateCoupon: { ...used, enabled: false } } },
      },
      listMock([{ ...used, enabled: false }]),
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar cupom PROMO10' }));
    expect(screen.getByText(/tipo e valor não podem mais mudar/)).toBeInTheDocument();
    expect(screen.getByLabelText('Desconto (%)')).toBeDisabled();
    expect(screen.getByLabelText('Valor fixo')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Ativo'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cupom' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Inativo')).toBeInTheDocument();
  });

  it('shows the server message when the save is refused', async () => {
    renderTab([
      listMock([]),
      {
        request: {
          query: CREATE_COUPON,
          variables: {
            data: {
              code: 'DUP',
              event: 'ev1',
              starts_at: null,
              expires_at: null,
              max_uses: null,
              enabled: true,
              batches: [],
              discount_type: 'percentage',
              discount_percentage: 10,
              discount_value_cents: null,
            },
          },
        },
        result: { errors: [{ message: 'Já existe um cupom com este código neste evento.' } as any] },
      },
    ]);
    fireEvent.click(await screen.findByRole('button', { name: /Novo cupom/ }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'DUP' } });
    fireEvent.change(screen.getByLabelText('Desconto (%)'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cupom' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um cupom com este código neste evento.');
  });
});
