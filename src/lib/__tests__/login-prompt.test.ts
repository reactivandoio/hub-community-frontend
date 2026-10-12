import { beforeEach, describe, expect, it } from 'vitest';

import { legacyLoginTarget, safeReturnPath, saveLoginReturn, takeLoginReturn } from '../login-prompt';

beforeEach(() => window.localStorage.clear());

describe('safeReturnPath', () => {
  it('only accepts paths of this site', () => {
    expect(safeReturnPath('/admin/events?x=1')).toBe('/admin/events?x=1');
    expect(safeReturnPath('//evil.example/x')).toBeNull();
    expect(safeReturnPath('/\\evil.example')).toBeNull();
    expect(safeReturnPath('https://evil.example')).toBeNull();
    expect(safeReturnPath('')).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
  });

  it('refuses what a browser would turn into another site (tab, line break, backslash)', () => {
    // URLSearchParams decodes %09 and %0A; the URL parser then drops them: "/\t/evil" → "//evil".
    expect(safeReturnPath('/\t/evil.example')).toBeNull();
    expect(safeReturnPath('/\n/evil.example')).toBeNull();
    expect(safeReturnPath('/\r\n/evil.example/x')).toBeNull();
    expect(safeReturnPath('/x\\..\\evil')).toBeNull();
    expect(safeReturnPath('/%2F%2Fevil.example')).toBe('/%2F%2Fevil.example');
    expect(legacyLoginTarget('/', '?login=true&redirect=%2F%09%2Fevil.example')).toEqual({ path: '/' });
    expect(legacyLoginTarget('/', '?login=true&redirect=https%3A%2F%2Fevil.example')).toEqual({ path: '/' });
  });

  it('keeps query and fragment of an internal path', () => {
    expect(safeReturnPath('/events/meetup/signup?ticket=1#cupom=PROMO10')).toBe('/events/meetup/signup?ticket=1#cupom=PROMO10');
    expect(safeReturnPath('/admin/events/abc#products')).toBe('/admin/events/abc#products');
  });
});

describe('legacyLoginTarget (old ?login=true links)', () => {
  it('goes to the redirect, with the modal open there', () => {
    expect(legacyLoginTarget('/', '?login=true&redirect=%2Fadmin%2Fevents%3Ftab%3D1')).toEqual({
      path: '/admin/events?tab=1',
    });
    expect(legacyLoginTarget('/', 'login=true&redirect=%2Fevents%2Fmeetup%2Fsignup%23cupom%3DPROMO10')).toEqual({
      path: '/events/meetup/signup#cupom=PROMO10',
    });
  });

  it('stays on the page without a redirect (or with one off the site), dropping the login params', () => {
    expect(legacyLoginTarget('/events/meetup', '?login=true&tab=2', '#agenda')).toEqual({
      path: '/events/meetup?tab=2#agenda',
    });
    expect(legacyLoginTarget('/', '?login=true&redirect=https%3A%2F%2Fevil.example')).toEqual({ path: '/' });
  });

  it('ignores any other URL', () => {
    expect(legacyLoginTarget('/admin', '')).toBeNull();
    expect(legacyLoginTarget('/admin', '?redirect=%2Fx')).toBeNull();
    expect(legacyLoginTarget('/admin', '?login=false')).toBeNull();
  });
});

describe('login return (signup and password e-mails)', () => {
  it('keeps the page once', () => {
    saveLoginReturn('/certificado?event=meetup');
    expect(takeLoginReturn()).toBe('/certificado?event=meetup');
    expect(takeLoginReturn()).toBeNull();
  });

  it('forgets it after a day and never keeps another site', () => {
    saveLoginReturn('/events/meetup', 0);
    expect(takeLoginReturn(25 * 60 * 60 * 1000)).toBeNull();
    saveLoginReturn('//evil.example');
    expect(takeLoginReturn()).toBeNull();
  });
});
