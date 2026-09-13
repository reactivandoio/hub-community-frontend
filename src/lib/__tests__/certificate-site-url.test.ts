// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteBaseUrl } from '../certificate-server';

const req = (origin: string, headers: Record<string, string> = {}) => ({
  headers: new Headers(headers),
  nextUrl: { origin },
});

describe('siteBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers NEXT_PUBLIC_SITE_URL (without trailing slash)', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://hubcommunity.io/');
    expect(siteBaseUrl(req('http://localhost:4010'))).toBe('https://hubcommunity.io');
  });

  it('uses the forwarded host behind a reverse proxy', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(
      siteBaseUrl(req('http://localhost:4010', { 'x-forwarded-host': 'hubcommunity.io', 'x-forwarded-proto': 'https' })),
    ).toBe('https://hubcommunity.io');
  });

  it('never emits localhost from a production build', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(siteBaseUrl(req('http://localhost:4010'))).toBe('https://hubcommunity.io');
  });

  it('keeps the request origin in development', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(siteBaseUrl(req('http://localhost:4011'))).toBe('http://localhost:4011');
  });
});
