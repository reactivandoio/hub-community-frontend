import { describe, expect, it } from 'vitest';

import {
  aiSettingsHref,
  draftOf,
  formatVerifiedAt,
  isGenerationActive,
  needsSetup,
  newRequestId,
  previewTail,
  readError,
  safeReturnTo,
} from '../ai-text';

describe('AI text rules (REA-51)', () => {
  it('knows which runs are still going', () => {
    expect(isGenerationActive('queued')).toBe(true);
    expect(isGenerationActive('running')).toBe(true);
    expect(isGenerationActive('succeeded')).toBe(false);
    expect(isGenerationActive('failed')).toBe(false);
    expect(isGenerationActive('cancelled')).toBe(false);
    expect(isGenerationActive(null)).toBe(false);
  });

  it('links to the settings and back to the campaign page', () => {
    expect(aiSettingsHref()).toBe('/admin/configuracoes/ia');
    expect(aiSettingsHref('/admin/events/ev-1/email')).toBe('/admin/configuracoes/ia?voltar=%2Fadmin%2Fevents%2Fev-1%2Femail');
  });

  it('only goes back to a path inside the admin', () => {
    expect(safeReturnTo('/admin/events/x/email')).toBe('/admin/events/x/email');
    expect(safeReturnTo('https://evil.io')).toBeNull();
    expect(safeReturnTo('//evil.io/admin')).toBeNull();
    expect(safeReturnTo('/events/x')).toBeNull();
    expect(safeReturnTo('/admin\\@evil')).toBeNull();
    expect(safeReturnTo(null)).toBeNull();
  });

  it('sends the token and project errors to the settings', () => {
    ['TERMHUB_NOT_CONFIGURED', 'TERMHUB_TOKEN_INVALID', 'TERMHUB_TOKEN_SCOPE', 'TERMHUB_TOKEN_UNREADABLE', 'TERMHUB_NOT_FOUND']
      .forEach((code) => expect(needsSetup(code)).toBe(true));
    ['TERMHUB_BUSY', 'TERMHUB_RATE_LIMITED', 'agent_offline', null].forEach((code) => expect(needsSetup(code)).toBe(false));
  });

  it('reads the BFF code, message and retryAfter of an Apollo error', () => {
    const error = { graphQLErrors: [{ message: 'Limite', extensions: { code: 'TERMHUB_HOURLY_LIMIT', retryAfter: 600 } }], message: 'x' };
    expect(readError(error)).toEqual({ code: 'TERMHUB_HOURLY_LIMIT', message: 'Limite', retryAfter: 600 });
    expect(readError({ message: 'Failed to fetch' })).toEqual({ code: null, message: 'Failed to fetch', retryAfter: null });
    expect(readError(null).message).toMatch(/servidor/);
  });

  it('shows the end of a long preview', () => {
    expect(previewTail('  abc ')).toBe('abc');
    const long = 'x'.repeat(700) + 'FIM';
    expect(previewTail(long).endsWith('FIM')).toBe(true);
    expect(previewTail(long).startsWith('…')).toBe(true);
    expect(previewTail(null)).toBe('');
  });

  it('applies only a succeeded draft with a subject', () => {
    expect(draftOf({ status: 'succeeded', subject: 'S', message: null })).toEqual({ subject: 'S', message: '' });
    expect(draftOf({ status: 'failed', subject: 'S', message: 'M' })).toBeNull();
    expect(draftOf({ status: 'succeeded', subject: null, message: 'M' })).toBeNull();
  });

  it('makes a new request id each time', () => {
    expect(newRequestId()).not.toBe(newRequestId());
  });

  it('formats the last check in São Paulo time', () => {
    expect(formatVerifiedAt('2026-11-15T17:03:00Z')).toBe('15/11/2026, 14:03');
    expect(formatVerifiedAt(null)).toBeNull();
    expect(formatVerifiedAt('nope')).toBeNull();
  });
});
