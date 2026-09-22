import { describe, it, expect } from 'vitest';
import { formatCpf } from '../cpf';

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
