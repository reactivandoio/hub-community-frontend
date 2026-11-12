import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgeReviewPage from '../page';

const requestDob = vi.fn();
const blockMinor = vi.fn();
const refetch = vi.fn().mockResolvedValue({});
const toast = vi.fn();
const reviewCalls: any[] = [];

const base = {
  username: null, name: null, blocked: false, createdAt: '2026-01-01T12:00:00.000Z', age: null,
  adultDeclaredAt: null, status: null, requestedAt: null, deadline: null, blockedAt: null,
};
const noDob = [
  { ...base, id: '10', email: 'ana@x.io', name: 'Ana', dateOfBirth: null },
  { ...base, id: '11', email: 'bia@x.io', dateOfBirth: null, status: 'dob_requested', requestedAt: '2026-11-10T12:00:00.000Z', deadline: '2099-11-17T12:00:00.000Z' },
];
const minors = [
  { ...base, id: '20', email: 'teen@x.io', name: 'Teen', dateOfBirth: '2010-05-05', age: 16 },
  { ...base, id: '21', email: 'kid@x.io', dateOfBirth: '2012-01-01', age: 14, blocked: true, status: 'minor_blocked' },
];
const page = (items: unknown[], emailsLeftToday = 70) => ({
  data: { adminAgeReview: { items, total: items.length, page: 1, pageSize: 50, emailsLeftToday } },
  loading: false,
  refetch,
});
let emailsLeft = 70;

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  const name = (doc: any) => doc?.definitions?.[0]?.name?.value;
  return {
    ...actual,
    useQuery: (doc: any, options: any) => {
      if (name(doc) === 'AdminAgeReviewSummary') {
        return {
          data: { adminAgeReviewSummary: { noBirthDate: 2, notRequested: 1, requested: 1, minors: 2, minorsBlocked: 1, emailsLeftToday: emailsLeft } },
          refetch,
        };
      }
      reviewCalls.push(options.variables);
      return options.variables.kind === 'MINOR' ? page(minors, emailsLeft) : page(noDob, emailsLeft);
    },
    useMutation: (doc: any) =>
      name(doc) === 'AdminBlockMinor' ? [blockMinor, { loading: false }] : [requestDob, { loading: false }],
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  reviewCalls.length = 0;
  emailsLeft = 70;
});

describe('Idade (18+) — sem data de nascimento', () => {
  it('lists the accounts without action first and shows the counts and the e-mails left', () => {
    render(<AgeReviewPage />);
    expect(reviewCalls).toContainEqual({ kind: 'NO_BIRTH_DATE', status: 'NONE', page: 1, pageSize: 50 });
    expect(screen.getByText('E-mails restantes hoje')).toBeInTheDocument();
    expect(screen.getByText('1 sem ação · 1 aguardando')).toBeInTheDocument();
  });

  it('only accounts not asked yet can be selected; sending asks first and reports the result', async () => {
    requestDob.mockResolvedValue({
      data: { adminRequestDateOfBirth: { sent: 1, failed: 0, skipped: 0, emailsLeftToday: 69, results: [{ userId: '10', outcome: 'sent', message: null }] } },
    });
    render(<AgeReviewPage />);
    expect(screen.getByRole('checkbox', { name: 'Selecionar bia@x.io' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar ana@x.io' }));
    await userEvent.click(screen.getByRole('button', { name: /Pedir data de nascimento \(1\)/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('7 dias');
    expect(requestDob).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(requestDob).toHaveBeenCalledWith({ variables: { userIds: ['10'] } }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: '1 e-mail(s) enviado(s)' }));
  });

  it('disables sending when no e-mail is left today', async () => {
    emailsLeft = 0;
    render(<AgeReviewPage />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar ana@x.io' }));
    expect(screen.getByRole('button', { name: /Pedir data de nascimento/ })).toBeDisabled();
  });
});

describe('Idade (18+) — menores de idade', () => {
  it('deactivates a minor only after confirming, and offers re-sending for one already deactivated', async () => {
    blockMinor.mockResolvedValue({
      data: { adminBlockMinor: { emailSent: true, message: 'Conta desativada. E-mail com o motivo enviado.', emailsLeftToday: 69, user: { ...minors[0], blocked: true, status: 'minor_blocked' } } },
    });
    render(<AgeReviewPage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Menores de idade' }));
    expect(screen.getByText('05/05/2010 (16 anos)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reenviar e-mail/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Desativar e avisar/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('teen@x.io');
    expect(blockMinor).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desativar e avisar' }));
    await waitFor(() => expect(blockMinor).toHaveBeenCalledWith({ variables: { userId: '20' } }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Conta desativada' }));
  });
});
