import { describe, expect, it } from 'vitest';
import { paymentsV2FromProbe, typeHasField } from '../server-support';

const validation = {
  message: 'Cannot query field "signupPaymentStatus" on type "Query".',
  extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
};

describe('paymentsV2FromProbe', () => {
  it('is unknown while the probe runs', () => {
    expect(paymentsV2FromProbe({ loading: true })).toBeNull();
  });

  it('is on when the BFF answers the probe, even with null', () => {
    expect(paymentsV2FromProbe({ loading: false, data: { signupPaymentStatus: null } })).toBe(true);
  });

  it('is on when the field exists but the resolver failed', () => {
    const error = { graphQLErrors: [{ message: 'Pagamento não encontrado', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] };
    expect(paymentsV2FromProbe({ loading: false, error })).toBe(true);
  });

  it('is off when the BFF does not know the field (400 from Apollo Server)', () => {
    const error = { graphQLErrors: [], networkError: { statusCode: 400, result: { errors: [validation] } } };
    expect(paymentsV2FromProbe({ loading: false, error })).toBe(false);
    expect(paymentsV2FromProbe({ loading: false, error: { graphQLErrors: [validation] } })).toBe(false);
  });

  it('is off when the BFF cannot be reached (keeps today\'s behaviour)', () => {
    expect(paymentsV2FromProbe({ loading: false, error: { graphQLErrors: [], networkError: new Error('Failed to fetch') } })).toBe(false);
  });
});

describe('typeHasField (REA-16)', () => {
  const fields = (...names: string[]) => ({ __type: { fields: names.map((name) => ({ name })) } });

  it('waits while asking', () => {
    expect(typeHasField({ loading: true }, 'half_price')).toBeNull();
  });

  it('finds the field in the introspected type', () => {
    expect(typeHasField({ loading: false, data: fields('id', 'half_price') }, 'half_price')).toBe(true);
    expect(typeHasField({ loading: false, data: fields('id', 'name') }, 'half_price')).toBe(false);
  });

  it('treats an error or a missing type as no field', () => {
    expect(typeHasField({ loading: false, error: { graphQLErrors: [{ message: 'introspection off' }] } }, 'half_price')).toBe(false);
    expect(typeHasField({ loading: false, data: { __type: null } }, 'half_price')).toBe(false);
  });
});
