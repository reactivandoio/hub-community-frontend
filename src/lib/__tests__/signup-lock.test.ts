import { describe, it, expect, beforeEach } from 'vitest';
import { acquireSignupLock, releaseSignupLock, SIGNUP_LOCK_MS } from '../signup-lock';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe('signup lock', () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('acquires a free lock and refuses a second attempt while it is held', () => {
    expect(acquireSignupLock('evt', 'Ana@X.io', { storage, now: 1000 })).toBe(true);
    expect(acquireSignupLock('evt', 'ana@x.io', { storage, now: 2000 })).toBe(false);
  });

  it('lets the person retry right away once a failed attempt releases it', () => {
    // A rejected password used to leave the lock behind, so the corrected
    // retry was told "Inscrição em andamento" instead of going through.
    acquireSignupLock('evt', 'ana@x.io', { storage, now: 1000 });
    releaseSignupLock('evt', 'ana@x.io', { storage });

    expect(acquireSignupLock('evt', 'ana@x.io', { storage, now: 1500 })).toBe(true);
  });

  it('expires on its own after the lock window', () => {
    acquireSignupLock('evt', 'ana@x.io', { storage, now: 1000 });

    expect(acquireSignupLock('evt', 'ana@x.io', { storage, now: 1000 + SIGNUP_LOCK_MS })).toBe(true);
  });

  it('keys the lock by event and e-mail', () => {
    acquireSignupLock('evt', 'ana@x.io', { storage, now: 1000 });

    expect(acquireSignupLock('other', 'ana@x.io', { storage, now: 1000 })).toBe(true);
    expect(acquireSignupLock('evt', 'bia@x.io', { storage, now: 1000 })).toBe(true);
  });

  it('never blocks when there is no storage', () => {
    expect(acquireSignupLock('evt', 'ana@x.io', { storage: undefined, now: 1000 })).toBe(true);
    expect(() => releaseSignupLock('evt', 'ana@x.io', { storage: undefined })).not.toThrow();
  });
});
