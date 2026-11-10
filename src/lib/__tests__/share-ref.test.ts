import { describe, expect, it } from 'vitest';

import { SHARE_REF_KEY, captureShareRef, parseShareRef } from '@/lib/share-ref';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

describe('parseShareRef', () => {
  it('reads a well-formed ref', () => {
    expect(parseShareRef('?ref=AbC123_-xy&utm_source=email')).toBe('AbC123_-xy');
  });

  it('ignores a missing or strange ref', () => {
    expect(parseShareRef('')).toBeNull();
    expect(parseShareRef('?ref=')).toBeNull();
    expect(parseShareRef('?ref=<script>')).toBeNull();
    expect(parseShareRef('?ref=abc')).toBeNull();
  });
});

describe('captureShareRef', () => {
  it('remembers the ref of the URL for the session', () => {
    const storage = memoryStorage();
    expect(captureShareRef('?ref=AbC123_-xy', storage)).toBe('AbC123_-xy');
    expect(storage.getItem(SHARE_REF_KEY)).toBe('AbC123_-xy');
    expect(captureShareRef('', storage)).toBe('AbC123_-xy');
  });

  it('lets a new link replace the old one', () => {
    const storage = memoryStorage();
    captureShareRef('?ref=first1234', storage);
    expect(captureShareRef('?ref=second123', storage)).toBe('second123');
  });

  it('works without storage', () => {
    expect(captureShareRef('?ref=AbC123_-xy', null)).toBe('AbC123_-xy');
    expect(captureShareRef('', null)).toBeNull();
  });
});
