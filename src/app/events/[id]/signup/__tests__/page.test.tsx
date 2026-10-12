import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EventSignupPage from '../page';

const signupV2 = vi.fn();
const signupLegacy = vi.fn();
const previewCoupon = vi.fn();
const validateCoupon = vi.fn();
let paymentsV2: boolean | null = true;

const event = {
  id: 'ev1',
  documentId: 'ev1',
  slug: 'meetup',
  title: 'Meetup',
  start_date: '2026-11-01T10:00:00.000Z',
  end_date: '2026-11-01T12:00:00.000Z',
  products: [
    {
      id: 'p1',
      name: 'Ingresso',
      enabled: true,
      batches: [{ id: 'b1', batch_number: 1, value: 5000, max_quantity: 10, enabled: true, half_price_eligible: false }],
    },
  ],
};

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'meetup' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { email: 'ana@example.com', username: 'ana', name: 'Ana', phone: '+55 11 99999-0000' },
    isAuthenticated: true,
    updatePhone: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-tracking', () => ({ useTracking: () => ({ track: vi.fn() }) }));
vi.mock('@/hooks/use-payments-v2', () => ({ usePaymentsV2: () => paymentsV2 }));
vi.mock('@/components/signup-ticket-qr', () => ({ SignupTicketQr: () => null }));
vi.mock('@/components/add-to-calendar-button', () => ({ AddToCalendarButton: () => null }));
vi.mock('@/components/signup-pix-payment', () => ({
  SignupPixPayment: ({ initial }: { initial: { value: number } }) => <div>Passo Opa Pingou {initial.value}</div>,
}));
// Matched by operation name: importing @/lib/queries here would import this very
// mock again and never resolve (see docs/lessons).
vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  const name = (doc: any) => doc?.definitions?.[0]?.name?.value;
  return {
    ...actual,
    useQuery: (doc: any) =>
      name(doc) === 'GetEventBySlugOrId'
        ? { data: { eventBySlugOrId: event }, loading: false }
        : { data: undefined, loading: false },
    useLazyQuery: (doc: any) =>
      name(doc) === 'PreviewCoupon' ? [previewCoupon, { loading: false }] : [validateCoupon, { loading: false }],
    useMutation: (doc: any) =>
      name(doc) === 'SignupToEventV2' ? [signupV2, { loading: false }] : [signupLegacy, { loading: false }],
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  paymentsV2 = true;
  event.products[0].batches[0].half_price_eligible = false;
});

const goToConfirm = async () => {
  render(<EventSignupPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar para pagamento' }));
};

describe('EventSignupPage (REA-6)', () => {
  it('shows the coupon price the server computed, with the discount and the minimum notice', async () => {
    previewCoupon.mockResolvedValue({
      data: {
        previewCoupon: {
          valid: true,
          message: 'Cupom aplicado: maior que a meia-entrada.',
          discount_kind: 'coupon',
          final_value: 100,
          original_value: 5000,
          min_charge_applied: true,
        },
      },
    });
    render(<EventSignupPage />);
    fireEvent.change(await screen.findByPlaceholderText('Digite seu cupom'), { target: { value: 'promo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Cupom aplicado: maior que a meia-entrada.')).toBeInTheDocument();
    expect(previewCoupon).toHaveBeenCalledWith({
      variables: { eventSlug: 'meetup', batchId: 'b1', code: 'PROMO', isStudent: false },
    });
    expect(screen.getByText('Desconto do cupom')).toBeInTheDocument();
    expect(screen.getByText('-R$ 49,00')).toBeInTheDocument();
    expect(screen.getByText('O valor foi ajustado para o mínimo de cobrança: R$ 1,00.')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 1,00').length).toBeGreaterThan(0);
  });

  it('requires a valid CPF before calling the server', async () => {
    await goToConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Inscrição' }));
    expect(await screen.findByText('Informe seu CPF.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '52998224724' } });
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-24');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Inscrição' }));
    expect(await screen.findByText('Informe um CPF válido.')).toBeInTheDocument();
    expect(signupV2).not.toHaveBeenCalled();
  });

  it('sends the CPF digits and Pix, and opens the Opa Pingou step', async () => {
    signupV2.mockResolvedValue({
      data: {
        signupToEvent: {
          success: true,
          is_free: false,
          signup_id: '42',
          payment: { payment_provider: 'opapingou', kind: 'PIX_QR', pix_br_code: 'abc', value: 5000 },
        },
      },
    });
    await goToConfirm();
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Inscrição' }));
    expect(await screen.findByText('Passo Opa Pingou 5000')).toBeInTheDocument();
    expect(signupV2.mock.calls[0][0].variables).toMatchObject({
      eventId: 'meetup',
      batch_id: 'b1',
      cpf: '52998224725',
      kind: 'PIX_QR',
    });
    expect(signupLegacy).not.toHaveBeenCalled();
  });

  it('puts the server CPF message under the field', async () => {
    signupV2.mockResolvedValue({ data: { signupToEvent: { success: false, message: 'Informe um CPF válido.' } } });
    await goToConfirm();
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Inscrição' }));
    await waitFor(() => expect(screen.getByLabelText('CPF')).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('Informe um CPF válido.')).toBeInTheDocument();
  });

  it('keeps the old signup (no CPF field, old mutation) while the BFF is the old one', async () => {
    paymentsV2 = false;
    signupLegacy.mockResolvedValue({ data: { signupToEvent: { success: true, is_free: false, signup_id: '42', payment: { qr_code: 'x' } } } });
    await goToConfirm();
    expect(screen.queryByLabelText('CPF')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Inscrição' }));
    await waitFor(() => expect(signupLegacy).toHaveBeenCalled());
    expect(signupLegacy.mock.calls[0][0].variables).not.toHaveProperty('cpf');
    expect(signupV2).not.toHaveBeenCalled();
  });
});

const preview = (discount_kind: string | null, final_value: number, message: string | null = null) => ({
  data: { previewCoupon: { valid: true, message, discount_kind, final_value, original_value: 5000, min_charge_applied: false } },
});

describe('EventSignupPage (REA-16 meia-entrada)', () => {
  it('has no half-price choice when the batch does not offer it', async () => {
    render(<EventSignupPage />);
    await screen.findByRole('button', { name: 'Continuar para pagamento' });
    expect(screen.queryByLabelText('Quero meia-entrada')).not.toBeInTheDocument();
  });

  it('offers the choice unchecked, shows the server price and sends it with the signup', async () => {
    event.products[0].batches[0].half_price_eligible = true;
    previewCoupon.mockResolvedValue(preview('student', 2500));
    signupV2.mockResolvedValue({
      data: { signupToEvent: { success: true, is_free: false, signup_id: '7', payment: { payment_provider: 'opapingou', kind: 'PIX_QR', value: 2500 } } },
    });
    render(<EventSignupPage />);
    const box = await screen.findByLabelText('Quero meia-entrada');
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    await waitFor(() =>
      expect(previewCoupon).toHaveBeenCalledWith({
        variables: { eventSlug: 'meetup', batchId: 'b1', code: '', isStudent: true },
      }),
    );
    expect(await screen.findByText('Meia-entrada')).toBeInTheDocument();
    expect(screen.getByText('-R$ 25,00')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 25,00').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar para pagamento' }));
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Inscrição' }));
    expect(await screen.findByText('Passo Opa Pingou 2500')).toBeInTheDocument();
    expect(signupV2.mock.calls[0][0].variables).toMatchObject({ is_student: true });
    expect(signupV2.mock.calls[0][0].variables).not.toHaveProperty('coupon_code');
  });

  it('with a coupon too, says which discount the server kept', async () => {
    event.products[0].batches[0].half_price_eligible = true;
    previewCoupon
      .mockResolvedValueOnce(preview('coupon', 4000, 'Cupom aplicado.'))
      .mockResolvedValueOnce(preview('student', 2500, 'A meia-entrada dá um desconto maior ou igual: o cupom não será usado.'));
    signupV2.mockResolvedValue({ data: { signupToEvent: { success: true, is_free: false, signup_id: '7', payment: { value: 2500 } } } });
    render(<EventSignupPage />);
    fireEvent.change(await screen.findByPlaceholderText('Digite seu cupom'), { target: { value: 'promo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Desconto do cupom')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Quero meia-entrada'));
    await waitFor(() =>
      expect(previewCoupon).toHaveBeenLastCalledWith({
        variables: { eventSlug: 'meetup', batchId: 'b1', code: 'PROMO', isStudent: true },
      }),
    );
    expect(await screen.findByTestId('best-discount')).toHaveTextContent('Vale a meia-entrada');

    fireEvent.click(screen.getByRole('button', { name: 'Continuar para pagamento' }));
    fireEvent.change(screen.getByLabelText('CPF'), { target: { value: '529.982.247-25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Inscrição' }));
    await waitFor(() => expect(signupV2).toHaveBeenCalled());
    // The server picks the larger discount again at signup: both go.
    expect(signupV2.mock.calls[0][0].variables).toMatchObject({ is_student: true, coupon_code: 'PROMO' });
  });

  it('unchecking goes back to the full price without asking the server', async () => {
    event.products[0].batches[0].half_price_eligible = true;
    previewCoupon.mockResolvedValue(preview('student', 2500));
    render(<EventSignupPage />);
    const box = await screen.findByLabelText('Quero meia-entrada');
    fireEvent.click(box);
    await screen.findByText('-R$ 25,00');
    fireEvent.click(box);
    await waitFor(() => expect(screen.queryByText('-R$ 25,00')).not.toBeInTheDocument());
    expect(previewCoupon).toHaveBeenCalledTimes(1);
  });
});
