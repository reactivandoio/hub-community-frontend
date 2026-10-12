import { describe, it, expect } from 'vitest';
import { cpfError, formatCpf, isCpfMessage, maskCpfInput } from '../cpf';

describe('formatCpf', () => {
  it('masks 11 digits, keeping leading zeros', () => {
    // The mask is also what keeps Excel from reading it as a number and
    // dropping the leading zero.
    expect(formatCpf('07123456789')).toBe('071.234.567-89');
    expect(formatCpf('071.234.567-89')).toBe('071.234.567-89');
  });

  it('is empty for anything that is not a CPF', () => {
    expect(formatCpf(null)).toBe('');
    expect(formatCpf(undefined)).toBe('');
    expect(formatCpf('1234')).toBe('');
  });
});

describe('maskCpfInput', () => {
  it('masks as the person types and stops at 11 digits', () => {
    expect(maskCpfInput('529')).toBe('529');
    expect(maskCpfInput('5299')).toBe('529.9');
    expect(maskCpfInput('5299822')).toBe('529.982.2');
    expect(maskCpfInput('5299822472')).toBe('529.982.247-2');
    expect(maskCpfInput('52998224725999')).toBe('529.982.247-25');
    expect(maskCpfInput('abc')).toBe('');
  });
});

describe('cpfError', () => {
  it('accepts a valid CPF with or without mask', () => {
    expect(cpfError('529.982.247-25')).toBeNull();
    expect(cpfError(' 52998224725 ')).toBeNull();
  });

  it('refuses empty, short, repeated and wrong check digits', () => {
    expect(cpfError('')).toBe('Informe seu CPF.');
    expect(cpfError('5299822472')).toBe('Informe um CPF válido.');
    expect(cpfError('111.111.111-11')).toBe('Informe um CPF válido.');
    expect(cpfError('529.982.247-24')).toBe('Informe um CPF válido.');
  });
});

describe('isCpfMessage', () => {
  it('routes server messages about the CPF to the field', () => {
    expect(isCpfMessage('Informe um CPF válido.')).toBe(true);
    expect(isCpfMessage('Este evento já atingiu a lotação máxima.')).toBe(false);
    expect(isCpfMessage(null)).toBe(false);
  });
});
