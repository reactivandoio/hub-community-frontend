import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { CHECKIN_SIGNUP, CREDENTIAL_CHECKED_IN, EVENT_BATCHES, EVENT_SIGNUPS, MANUAL_SIGNUP } from '@/lib/queries';
import LiveBadgePrinterPage from '../page';

// ─── Mocks ────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useParams: () => ({ eventSlug: 'veredas-da-inovacao' }),
}));

const mockPrintBadge = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/badge-print', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/badge-print')>()),
  printBadge: (data: unknown) => mockPrintBadge(data),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: () => <canvas data-testid="qr" />,
}));

vi.mock('@/components/animations', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ─── Fixtures ─────────────────────────────────────────────────────

const SLUG = 'veredas-da-inovacao';

const signup = (over: Partial<{ id: string; name: string; email: string; checked_in: boolean; checked_in_at: string | null }> = {}) => ({
  id: 's9',
  name: 'Caio Melo',
  email: 'caio@x.io',
  phone_number: '+55 62 99999-9999',
  checked_in: false,
  checked_in_at: null,
  product_name: 'Participante - Ouvinte',
  ...over,
});

const signupsMock = (list: ReturnType<typeof signup>[] = []): MockedResponse => ({
  request: { query: EVENT_SIGNUPS, variables: { eventSlug: SLUG } },
  result: { data: { eventSignups: list } },
});

const subscriptionMock: MockedResponse = {
  request: { query: CREDENTIAL_CHECKED_IN, variables: { eventSlug: SLUG } },
  result: { data: { credentialCheckedIn: null } },
  delay: 60_000,
};

const batchesMock: MockedResponse = {
  request: { query: EVENT_BATCHES, variables: { slugOrId: SLUG } },
  result: {
    data: {
      eventBySlugOrId: {
        id: 'e1',
        title: 'Veredas da Inovação',
        products: [
          { id: '40', name: 'Importação', enabled: true, can_be_listed: false, batches: [{ id: '30', batch_number: 1, value: 0, enabled: true }] },
          { id: '48', name: 'Participante - Ouvinte', enabled: true, can_be_listed: true, batches: [{ id: '31', batch_number: 1, value: 0, enabled: true }] },
        ],
      },
    },
  },
};

const INPUT = { name: 'Caio Melo', email: 'caio@x.io', phone_number: '+55 62 99999-9999', cpf: '52998224725' };

const manualMock = (
  result: { account_created: boolean; matched_by: 'cpf' | 'email' | null; signup: ReturnType<typeof signup> },
): MockedResponse => ({
  request: { query: MANUAL_SIGNUP, variables: { eventSlug: SLUG, batchId: '31', input: INPUT } },
  result: { data: { manualSignup: { success: true, message: 'ok', ...result } } },
});

const checkinMock = (s: ReturnType<typeof signup>): MockedResponse => ({
  request: { query: CHECKIN_SIGNUP, variables: { eventSlug: SLUG, signupId: s.id } },
  result: { data: { checkinSignup: { success: true, message: 'ok', signup: { ...s, checked_in: true, checked_in_at: '2026-10-08T19:00:00.000Z' } } } },
});

const renderPage = (mocks: MockedResponse[]) =>
  render(
    <MockedProvider mocks={[signupsMock(), signupsMock(), signupsMock(), subscriptionMock, batchesMock, ...mocks]} addTypename={false}>
      <LiveBadgePrinterPage />
    </MockedProvider>,
  );

const fillAndSubmit = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /inscrição manual/i }));
  await userEvent.type(screen.getByLabelText(/nome completo/i), INPUT.name);
  await userEvent.type(screen.getByLabelText(/e-mail/i), 'Caio@X.io ');
  await userEvent.type(screen.getByLabelText(/whatsapp/i), INPUT.phone_number);
  await userEvent.type(screen.getByLabelText(/cpf/i), '529.982.247-25');
  await userEvent.click(screen.getByRole('button', { name: /inscrever e imprimir/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ─── Inscrição Manual ─────────────────────────────────────────────

describe('LiveBadgePrinterPage — Inscrição Manual', () => {
  it('sits next to "Credenciamento Manual"', async () => {
    renderPage([]);
    const manual = await screen.findByRole('button', { name: /credenciamento manual/i });
    const signupButton = screen.getByRole('button', { name: /inscrição manual/i });
    expect(signupButton.parentElement).toBe(manual.parentElement);
    expect(manual.nextElementSibling).toBe(signupButton);
  });

  it.each([
    ['found by CPF', { account_created: false, matched_by: 'cpf' as const }, /conta encontrada pelo CPF/],
    ['found by e-mail', { account_created: false, matched_by: 'email' as const }, /conta encontrada pelo e-mail/],
    ['new account', { account_created: true, matched_by: null }, /conta criada; e-mails de confirmação e de cadastro/],
  ])('%s: signs up on the active batch, checks in and prints the badge', async (_, result, message) => {
    const s = signup();
    renderPage([manualMock({ ...result, signup: s }), checkinMock(s)]);
    await fillAndSubmit();

    await waitFor(() => expect(mockPrintBadge).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Caio Melo' })), { timeout: 2000 });
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(message));
    expect(toast.error).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('only prints someone who was already signed up and checked in', async () => {
    const s = signup({ checked_in: true, checked_in_at: '2026-10-08T18:00:00.000Z' });
    // No check-in mock: calling it would fail the test with an error toast.
    renderPage([manualMock({ account_created: false, matched_by: 'cpf', signup: s })]);
    await fillAndSubmit();

    await waitFor(() => expect(mockPrintBadge).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/já estava inscrito/));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('asks for the CPF before calling the server', async () => {
    renderPage([]);
    await userEvent.click(await screen.findByRole('button', { name: /inscrição manual/i }));
    await userEvent.type(screen.getByLabelText(/nome completo/i), INPUT.name);
    await userEvent.type(screen.getByLabelText(/e-mail/i), INPUT.email);
    await userEvent.type(screen.getByLabelText(/whatsapp/i), INPUT.phone_number);
    await userEvent.click(screen.getByRole('button', { name: /inscrever e imprimir/i }));
    expect(await screen.findByText(/CPF com 11 dígitos/)).toBeInTheDocument();
    expect(mockPrintBadge).not.toHaveBeenCalled();
  });

  it('shows the server error and prints nothing', async () => {
    const failing: MockedResponse = {
      request: { query: MANUAL_SIGNUP, variables: { eventSlug: SLUG, batchId: '31', input: INPUT } },
      result: { data: { manualSignup: { success: false, message: 'Erro ao criar inscrição: down', account_created: false, matched_by: null, signup: null } } },
    };
    renderPage([failing]);
    await fillAndSubmit();
    expect(await screen.findByText('Erro ao criar inscrição: down')).toBeInTheDocument();
    expect(mockPrintBadge).not.toHaveBeenCalled();
  });
});
