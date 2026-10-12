import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SignupPixPayment } from '../signup-pix-payment';
import { SIGNUP_PAYMENT_STATUS } from '@/lib/queries';
import type { SignupPayment } from '@/lib/types';

const BR_CODE = '00020126580014br.gov.bcb.pix0136abc520400005303986540550.005802BR6304ABCD';
const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

const statusMock = (status: string, extra: Record<string, unknown> = {}): MockedResponse => ({
  request: { query: SIGNUP_PAYMENT_STATUS, variables: { signupId: '42' } },
  result: {
    data: {
      signupPaymentStatus: {
        signup_id: '42',
        status,
        provider: 'opapingou',
        expires_at: inAnHour(),
        confirmed_at: null,
        pix_br_code: BR_CODE,
        payment_link: null,
        kind: 'PIX_QR',
        value: 5000,
        refund_support: null,
        ...extra,
      },
    },
  },
});

const renderStep = (
  mocks: MockedResponse[],
  initial: Partial<SignupPayment> = {},
  extra: Partial<React.ComponentProps<typeof SignupPixPayment>> = {},
) => {
  const onPaid = vi.fn();
  const onRetry = vi.fn();
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <SignupPixPayment
        signupId="42"
        initial={{ pix_br_code: BR_CODE, expires_at: inAnHour(), value: 5000, ...initial }}
        onPaid={onPaid}
        onRetry={onRetry}
        {...extra}
      />
    </MockedProvider>,
  );
  return { onPaid, onRetry };
};

describe('SignupPixPayment', () => {
  it('shows the Pix copia-e-cola and the amount while the payment is pending', async () => {
    renderStep([statusMock('PEDING_PAYMENT')]);
    expect(screen.getByText('Pagamento pendente')).toBeInTheDocument();
    expect(screen.getByLabelText('Pix copia e cola')).toHaveValue(BR_CODE);
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
  });

  it('calls onPaid once the webhook has confirmed the payment', async () => {
    const { onPaid } = renderStep([statusMock('CONFIRMED', { confirmed_at: new Date().toISOString() })]);
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
  });

  it('shows the expired state and lets the person start over', async () => {
    const { onPaid, onRetry } = renderStep([statusMock('EXPIRED')]);
    expect(await screen.findByText('O prazo do Pix acabou')).toBeInTheDocument();
    expect(onPaid).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('treats a charge past its expiry as expired even before the server says so', async () => {
    renderStep([statusMock('PEDING_PAYMENT', { expires_at: new Date(Date.now() - 1000).toISOString() })], {
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await screen.findByText('O prazo do Pix acabou')).toBeInTheDocument();
  });

  it('counts down the 15-minute charge', async () => {
    const in15 = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    renderStep([statusMock('PEDING_PAYMENT', { expires_at: in15 })], { expires_at: in15 });
    expect(screen.getByTestId('payment-countdown').textContent).toMatch(/^1[45]:\d\d$/);
  });

  it('shows the discount and the minimum charge notice that came from the server', () => {
    renderStep([statusMock('PEDING_PAYMENT', { value: 100 })], {
      value: 100,
      original_value: 1000,
      discount_kind: 'coupon',
      min_charge_applied: true,
    });
    expect(screen.getByText('Desconto do cupom: de R$ 10,00 por R$ 1,00')).toBeInTheDocument();
    expect(screen.getByText('O valor foi ajustado para o mínimo de cobrança: R$ 1,00.')).toBeInTheDocument();
  });

  it('asks the parent for a payment link charge when the person picks the link', async () => {
    const onChangeKind = vi.fn().mockResolvedValue(null);
    renderStep([statusMock('PEDING_PAYMENT')], {}, { onChangeKind });
    fireEvent.click(screen.getByRole('radio', { name: /Link de pagamento/ }));
    await waitFor(() => expect(onChangeKind).toHaveBeenCalledWith('PAYMENT_LINK'));
  });

  it('drops the link option when the server says the link is unavailable', async () => {
    const onChangeKind = vi.fn().mockResolvedValue('Link indisponível, pague por Pix');
    renderStep([statusMock('PEDING_PAYMENT')], {}, { onChangeKind });
    fireEvent.click(screen.getByRole('radio', { name: /Link de pagamento/ }));
    expect(await screen.findByText(/O link de pagamento não está disponível/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Pix copia e cola')).toHaveValue(BR_CODE);
  });

  it('opens the payment link in a new tab and keeps waiting', () => {
    const link = 'https://pay.example.com/abc';
    renderStep(
      [statusMock('PEDING_PAYMENT', { kind: 'PAYMENT_LINK', pix_br_code: null, payment_link: link })],
      { kind: 'PAYMENT_LINK', pix_br_code: null, payment_link: link },
    );
    const anchor = screen.getByRole('link', { name: /Abrir link de pagamento/ });
    expect(anchor).toHaveAttribute('href', link);
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(screen.queryByLabelText('Pix copia e cola')).not.toBeInTheDocument();
    expect(screen.getByText(/Aguardando a confirmação/)).toBeInTheDocument();
  });

  it('shows the refund contact only when a WhatsApp number is configured', async () => {
    renderStep([
      statusMock('PEDING_PAYMENT', { refund_support: { text: 'Reembolso só pelo suporte.', whatsapp: '+55 11 90000-0000' } }),
    ]);
    const contact = await screen.findByRole('link', { name: /WhatsApp do suporte/ });
    expect(contact).toHaveAttribute('href', 'https://wa.me/5511900000000');
    expect(screen.getByText(/Reembolso só pelo suporte/)).toBeInTheDocument();
  });

  it('hides the refund contact without a number', async () => {
    renderStep([statusMock('PEDING_PAYMENT', { refund_support: { text: 'Reembolso só pelo suporte.', whatsapp: null } })]);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/Reembolso só pelo suporte/)).not.toBeInTheDocument();
  });
});
