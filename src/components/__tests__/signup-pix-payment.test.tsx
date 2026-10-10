import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SignupPixPayment } from '../signup-pix-payment';
import { SIGNUP_PAYMENT_STATUS } from '@/lib/queries';

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
        value: 5000,
        ...extra,
      },
    },
  },
});

const renderStep = (mocks: MockedResponse[], initial = {}) => {
  const onPaid = vi.fn();
  const onRetry = vi.fn();
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <SignupPixPayment
        signupId="42"
        initial={{ pix_br_code: BR_CODE, expires_at: inAnHour(), value: 5000, ...initial }}
        onPaid={onPaid}
        onRetry={onRetry}
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
});
