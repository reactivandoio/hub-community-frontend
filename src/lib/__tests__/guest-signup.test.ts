import { describe, expect, it } from 'vitest';

import { guestNextStep, guestNotice, paymentParam } from '../guest-signup';

describe('guest-signup (REA-22)', () => {
  it('vai para o Pix só na inscrição da própria pessoa em lote pago', () => {
    const payment = { pix_br_code: 'abc' };
    expect(guestNextStep({ outcome: 'NEW_ACCOUNT', is_free: false, payment })).toBe('payment');
    expect(guestNextStep({ outcome: 'EXISTING_ACCOUNT', is_free: false, payment })).toBe('payment');
    expect(guestNextStep({ outcome: 'NEW_ACCOUNT', is_free: true, payment: null })).toBe('success');
    expect(guestNextStep({ outcome: 'CPF_OWNER', is_free: false, payment })).toBe('success');
    expect(guestNextStep({ outcome: 'ALREADY_SIGNED_UP', is_free: false, payment })).toBe('success');
  });

  it('texto de cada caso, com a máscara quando o e-mail é de outra conta', () => {
    expect(guestNotice({ outcome: 'CPF_OWNER', confirmation_sent_to: 'glad****@***ail.com' }, 'x@y.io')).toMatchObject({
      ownSignup: false,
      body: expect.stringContaining('glad****@***ail.com'),
    });
    expect(guestNotice({ outcome: 'ALREADY_SIGNED_UP', confirmation_sent_to: 'glad****@***ail.com' }, 'x@y.io').ownSignup).toBe(false);
    expect(guestNotice({ outcome: 'NEW_ACCOUNT', confirmation_sent_to: 'x@y.io' }, 'x@y.io')).toMatchObject({
      ownSignup: true,
      body: expect.stringContaining('criar sua senha para x@y.io'),
    });
    expect(guestNotice({ outcome: 'EXISTING_ACCOUNT' }, 'x@y.io').body).toContain('x@y.io');
  });

  it('?pagamento= aceita só um id numérico', () => {
    expect(paymentParam('42')).toBe('42');
    expect(paymentParam(' 42 ')).toBe('42');
    expect(paymentParam('0')).toBeNull();
    expect(paymentParam('abc')).toBeNull();
    expect(paymentParam('42<script>')).toBeNull();
    expect(paymentParam(null)).toBeNull();
  });
});
