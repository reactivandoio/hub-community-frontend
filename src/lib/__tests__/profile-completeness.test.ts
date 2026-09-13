import { describe, it, expect } from 'vitest';
import { missingCertificateFields } from '@/lib/profile-completeness';

const complete = { email: 'ana@x.io', username: 'ana', name: 'Ana Souza', cpf: '52998224725', date_of_birth: '1990-05-17' };

describe('missingCertificateFields', () => {
  it('returns nothing for a complete profile', () => {
    expect(missingCertificateFields(complete)).toEqual([]);
  });

  it('flags a missing or blank name', () => {
    expect(missingCertificateFields({ ...complete, name: undefined })).toEqual(['name']);
    expect(missingCertificateFields({ ...complete, name: '   ' })).toEqual(['name']);
  });

  it('flags a missing or invalid CPF', () => {
    expect(missingCertificateFields({ ...complete, cpf: undefined })).toEqual(['cpf']);
    expect(missingCertificateFields({ ...complete, cpf: '111.111.111-11' })).toEqual(['cpf']);
  });

  it('accepts a formatted CPF', () => {
    expect(missingCertificateFields({ ...complete, cpf: '529.982.247-25' })).toEqual([]);
  });

  it('flags a missing date of birth', () => {
    expect(missingCertificateFields({ ...complete, date_of_birth: undefined })).toEqual(['date_of_birth']);
    expect(missingCertificateFields({ ...complete, date_of_birth: '' })).toEqual(['date_of_birth']);
  });

  it('lists every missing field in form order', () => {
    expect(missingCertificateFields({})).toEqual(['name', 'cpf', 'date_of_birth']);
  });
});
