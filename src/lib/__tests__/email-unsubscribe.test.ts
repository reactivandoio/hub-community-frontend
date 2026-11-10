import { describe, expect, it, vi } from 'vitest';

import { unsubscribeByToken } from '@/lib/email-unsubscribe';

const answer = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as typeof fetch;

describe('unsubscribeByToken', () => {
  it('sends the token to the BFF mutation', async () => {
    const fetchImpl = answer({ data: { unsubscribeEmail: true } });
    expect(await unsubscribeByToken('abc.def', fetchImpl)).toBe(true);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.query).toContain('unsubscribeEmail');
    expect(body.variables).toEqual({ token: 'abc.def' });
  });

  it('says false for an invalid token, without calling for an empty one', async () => {
    expect(await unsubscribeByToken('x.y', answer({ data: { unsubscribeEmail: false } }))).toBe(false);
    const fetchImpl = answer({});
    expect(await unsubscribeByToken('', fetchImpl)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws when the BFF fails', async () => {
    await expect(unsubscribeByToken('a.b', answer({}, false))).rejects.toThrow(/500/);
    await expect(unsubscribeByToken('a.b', answer({ errors: [{ message: 'down' }] }))).rejects.toThrow(/down/);
  });
});
