/**
 * Share link of a signup (REA-29): the "Convide alguém" e-mail gives each signup
 * `/events/<slug>?ref=<code>`. The code is kept for the browser session and sent as `metadata.ref`
 * with every tracked event (visit, signup…), so who brought whom can be counted later. It grants
 * nothing.
 */

export const SHARE_REF_KEY = 'hub_share_ref';

const REF_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

export function parseShareRef(search: string): string | null {
  const ref = new URLSearchParams(search).get('ref');
  return ref && REF_PATTERN.test(ref) ? ref : null;
}

/** The ref in the URL (remembered from now on), else the one remembered in this session. */
export function captureShareRef(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
): string | null {
  const fromUrl = parseShareRef(search);
  try {
    if (fromUrl) {
      storage?.setItem(SHARE_REF_KEY, fromUrl);
      return fromUrl;
    }
    const saved = storage?.getItem(SHARE_REF_KEY) ?? null;
    return saved && REF_PATTERN.test(saved) ? saved : null;
  } catch {
    return fromUrl;
  }
}
