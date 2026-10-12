import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PAYMENTS_V2_PROBE } from '@/lib/queries';

import { usePaymentsV2 } from '../use-payments-v2';
import { useRefetchOnFocus } from '../use-refetch-on-focus';

const oldServer: MockedResponse = {
  request: { query: PAYMENTS_V2_PROBE },
  result: {
    errors: [
      {
        message: 'Cannot query field "signupPaymentStatus" on type "Query".',
        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
      } as any,
    ],
  },
};
const newServer: MockedResponse = {
  request: { query: PAYMENTS_V2_PROBE },
  result: { data: { signupPaymentStatus: null } },
};

const wrapper =
  (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks} addTypename={false}>
      {children}
    </MockedProvider>
  );

describe('usePaymentsV2', () => {
  it('turns on when the tab regains focus after the BFF deploy, without a reload', async () => {
    const { result } = renderHook(() => usePaymentsV2(), { wrapper: wrapper([oldServer, newServer]) });
    await waitFor(() => expect(result.current).toBe(false));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(result.current).toBe(true));
  });
});

describe('useRefetchOnFocus', () => {
  it('asks again on focus only while active, at most once every 10 s', () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ active }) => useRefetchOnFocus(refetch, active), {
      initialProps: { active: false },
    });
    window.dispatchEvent(new Event('focus'));
    expect(refetch).not.toHaveBeenCalled();

    rerender({ active: true });
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('ignores a failed refetch', () => {
    const refetch = vi.fn().mockRejectedValue(new Error('offline'));
    renderHook(() => useRefetchOnFocus(refetch, true));
    expect(() => window.dispatchEvent(new Event('focus'))).not.toThrow();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
