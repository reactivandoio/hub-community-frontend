import { describe, expect, it } from 'vitest';

import { completeProfileHref, registrationIncomplete } from '../registration-incomplete';

describe('registrationIncomplete (REA-22)', () => {
  it('lê o código do BFF e o que falta', () => {
    const err = { graphQLErrors: [{ message: 'x', extensions: { code: 'REGISTRATION_INCOMPLETE', password_pending: false, missing: ['phone'] } }] };
    expect(registrationIncomplete(err)).toEqual({ passwordPending: false, missing: ['phone'] });
  });
  it('sem a lista (quem não é o dono) e com senha pendente', () => {
    const err = { graphQLErrors: [{ extensions: { code: 'REGISTRATION_INCOMPLETE', password_pending: true, missing: null } }] };
    expect(registrationIncomplete(err)).toEqual({ passwordPending: true, missing: null });
  });
  it('outro erro não é cadastro incompleto', () => {
    expect(registrationIncomplete({ graphQLErrors: [{ extensions: { code: 'BAD_USER_INPUT' } }] })).toBeNull();
    expect(registrationIncomplete(new Error('x'))).toBeNull();
    expect(registrationIncomplete(undefined)).toBeNull();
  });
  it('o login volta para a página do certificado', () => {
    expect(completeProfileHref('/certificado?event=meetup')).toBe('/?login=true&redirect=%2Fcertificado%3Fevent%3Dmeetup');
  });
});
