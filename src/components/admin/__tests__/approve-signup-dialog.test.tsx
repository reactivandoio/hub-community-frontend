import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APPROVE_SIGNUP_MANUALLY, SIGNUP_APPROVAL_PREVIEW } from '@/lib/queries';

import { ApproveSignupButton } from '../approve-signup-dialog';

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

const signup = {
  signup_id: 's-1',
  name: 'Ana Souza',
  email: 'ana@x.io',
  product_name: 'Ingresso',
  payment_status: 'EXPIRED',
};

const vars = { event: 'ev-1', signupId: 's-1' };

const preview = (data: Record<string, unknown>, delay = 0): MockedResponse => ({
  request: { query: SIGNUP_APPROVAL_PREVIEW, variables: vars },
  result: {
    data: { signupApprovalPreview: { approvable: true, reason: null, status: 'EXPIRED', warnings: [], ...data } },
  },
  delay,
});

const approve = (data: Record<string, unknown>) => {
  const result = vi.fn(() => ({
    data: {
      approveSignupManually: {
        success: true,
        message: null,
        already_approved: false,
        warnings: [],
        email_sent: true,
        ...data,
      },
    },
  }));
  return { mock: { request: { query: APPROVE_SIGNUP_MANUALLY, variables: vars }, result } as MockedResponse, result };
};

const renderButton = (mocks: MockedResponse[], onApproved = vi.fn()) => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <ApproveSignupButton event="ev-1" signup={signup} onApproved={onApproved} />
    </MockedProvider>,
  );
  return onApproved;
};

describe('ApproveSignupButton (REA-34)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows who is being approved, the no-charge notice and the preview warnings', async () => {
    renderButton([preview({ warnings: ['BATCH_FULL', 'COUPON_EXHAUSTED'] }, 300)]);
    fireEvent.click(screen.getByRole('button', { name: /Aprovar/ }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Ana Souza');
    expect(dialog).toHaveTextContent('ana@x.io');
    expect(dialog).toHaveTextContent('Ingresso');
    expect(dialog).toHaveTextContent('Expirado');
    expect(dialog).toHaveTextContent(/Não será gerada cobrança/);
    // While the preview loads, confirm stays off.
    expect(screen.getByRole('status', { name: 'Verificando inscrição' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar inscrição' })).toBeDisabled();

    expect(await screen.findByText(/lote está lotado/)).toBeInTheDocument();
    expect(screen.getByText(/cupom usado já está esgotado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar inscrição' })).toBeEnabled();
  });

  it('shows why a signup cannot be approved and keeps confirm off', async () => {
    renderButton([preview({ approvable: false, reason: 'REFUNDED', status: 'REFUND' })]);
    fireEvent.click(screen.getByRole('button', { name: /Aprovar/ }));
    expect(await screen.findByText(/foi reembolsado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar inscrição' })).toBeDisabled();
  });

  it('approves, tells the admin and asks the page to refresh', async () => {
    const { mock, result } = approve({});
    const onApproved = renderButton([preview({}), mock]);
    fireEvent.click(screen.getByRole('button', { name: /Aprovar/ }));
    const confirm = await screen.findByRole('button', { name: 'Aprovar inscrição' });
    await waitFor(() => expect(confirm).toBeEnabled());

    fireEvent.click(confirm);

    await waitFor(() => expect(onApproved).toHaveBeenCalled());
    expect(result).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Inscrição aprovada', description: expect.stringMatching(/e-mail/) }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('shows the server message when it refuses', async () => {
    const { mock } = approve({ success: false, message: 'Pagamento reembolsado não pode ser aprovado.' });
    const onApproved = renderButton([preview({}), mock]);
    fireEvent.click(screen.getByRole('button', { name: /Aprovar/ }));
    const confirm = await screen.findByRole('button', { name: 'Aprovar inscrição' });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'Pagamento reembolsado não pode ser aprovado.' }),
      ),
    );
    expect(onApproved).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
