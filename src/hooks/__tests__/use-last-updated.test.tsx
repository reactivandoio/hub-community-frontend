import { NetworkStatus } from '@apollo/client';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatLastUpdated, useLastUpdated } from '../use-last-updated';

describe('useLastUpdated', () => {
  afterEach(() => vi.useRealTimers());

  it('is null until the first answer', () => {
    const { result } = renderHook(() => useLastUpdated(NetworkStatus.loading, false));
    expect(result.current).toBeNull();
  });

  it('records each answer of a poll, even a repeated one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T17:00:00Z'));
    const { result, rerender } = renderHook(({ status }) => useLastUpdated(status, false), {
      initialProps: { status: NetworkStatus.ready },
    });
    expect(result.current?.toISOString()).toBe('2026-11-10T17:00:00.000Z');

    vi.setSystemTime(new Date('2026-11-10T17:00:30Z'));
    rerender({ status: NetworkStatus.poll });
    expect(result.current?.toISOString()).toBe('2026-11-10T17:00:00.000Z');
    rerender({ status: NetworkStatus.ready });
    expect(result.current?.toISOString()).toBe('2026-11-10T17:00:30.000Z');
  });

  it('keeps the last good time when a refresh fails', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T17:00:00Z'));
    const { result, rerender } = renderHook(({ status, failed }) => useLastUpdated(status, failed), {
      initialProps: { status: NetworkStatus.ready, failed: false },
    });
    vi.setSystemTime(new Date('2026-11-10T17:00:30Z'));
    rerender({ status: NetworkStatus.poll, failed: false });
    rerender({ status: NetworkStatus.error, failed: true });
    expect(result.current?.toISOString()).toBe('2026-11-10T17:00:00.000Z');
  });
});

describe('formatLastUpdated', () => {
  it('shows date and time in pt-BR', () => {
    const text = formatLastUpdated(new Date(2026, 10, 10, 14, 23, 5));
    expect(text).toBe('10/11/2026, 14:23:05');
  });
});
