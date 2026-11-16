import { describe, expect, it } from 'vitest';

import { adminUserEditSchema, changedInput, editValuesOf, emailChangeNotes } from '@/lib/admin-user-edit';
import type { AdminUserProfile } from '@/lib/types';

const profile: AdminUserProfile = {
  id: '620',
  name: 'João',
  email: 'joao@errado.com',
  phone: '62 99999-0000',
  cpf_masked: '***.982.247-**',
  date_of_birth: '1990-05-01',
  marketing_opt_in: false,
  communities: [],
  events: [],
};

describe('admin user edit (REA-63)', () => {
  it('starts from the profile, with the CPF empty (it is never shown whole)', () => {
    expect(editValuesOf(profile)).toEqual({
      name: 'João', email: 'joao@errado.com', cpf: '', dateOfBirth: '1990-05-01', phone: '62 99999-0000', marketingOptIn: false,
    });
  });

  it('sends only what changed', () => {
    const values = { ...editValuesOf(profile), email: ' Joao@Certo.com ', cpf: '529.982.247-25', marketingOptIn: true };
    expect(changedInput(values, profile)).toEqual({ email: 'joao@certo.com', cpf: '52998224725', marketingOptIn: true });
    expect(changedInput({ ...editValuesOf(profile), email: 'JOAO@errado.com' }, profile)).toEqual({});
  });

  it('refuses an invalid e-mail, CPF or a minor before asking the server', () => {
    const base = editValuesOf(profile);
    expect(adminUserEditSchema.safeParse({ ...base, email: 'joao@' }).success).toBe(false);
    expect(adminUserEditSchema.safeParse({ ...base, cpf: '111.111.111-11' }).success).toBe(false);
    expect(adminUserEditSchema.safeParse({ ...base, dateOfBirth: '2015-01-01' }).success).toBe(false);
    expect(adminUserEditSchema.safeParse({ ...base, name: '  ' }).success).toBe(false);
    expect(adminUserEditSchema.safeParse(base).success).toBe(true);
  });

  it('warns about the sessions and the signups that stay', () => {
    expect(emailChangeNotes({ signupsToMove: 2, signupConflicts: 0 })).toHaveLength(2);
    expect(emailChangeNotes({ signupsToMove: 2, signupConflicts: 1 })[2]).toMatch(/1 inscrição/);
  });
});
