import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UnsubscribePage from '../page';

let mockSearchParams = new URLSearchParams();
const mockUnsubscribe = vi.fn();
let mockResult: { data?: { unsubscribeEmail: boolean }; loading: boolean; error?: Error } = { loading: false };

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  return { ...actual, useMutation: () => [mockUnsubscribe, mockResult] };
});

vi.mock('@/components/animations', () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockResult = { loading: false };
  mockUnsubscribe.mockResolvedValue({});
});

describe('UnsubscribePage', () => {
  it('says the link is invalid without a token', () => {
    render(<UnsubscribePage />);
    expect(screen.getByText('Link inválido')).toBeInTheDocument();
  });

  it('only unsubscribes after the click, with the token of the link', async () => {
    mockSearchParams = new URLSearchParams('t=abc.def');
    render(<UnsubscribePage />);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /confirmar descadastro/i }));
    await waitFor(() => expect(mockUnsubscribe).toHaveBeenCalledWith({ variables: { token: 'abc.def' } }));
  });

  it('confirms when the BFF recorded it', () => {
    mockSearchParams = new URLSearchParams('t=abc.def');
    mockResult = { loading: false, data: { unsubscribeEmail: true } };
    render(<UnsubscribePage />);
    expect(screen.getByText('Pronto, você foi descadastrado')).toBeInTheDocument();
  });

  it('says the link is invalid when the BFF refuses the token', () => {
    mockSearchParams = new URLSearchParams('t=abc.def');
    mockResult = { loading: false, data: { unsubscribeEmail: false } };
    render(<UnsubscribePage />);
    expect(screen.getByText('Link inválido')).toBeInTheDocument();
  });
});
