import { describe, it, expect } from 'vitest';
import { signupErrorMessage } from '../signup-error';

describe('signupErrorMessage', () => {
  it('translates the Strapi password limits', () => {
    expect(signupErrorMessage(new Error('Password must be less than 73 bytes'))).toBe(
      'A senha deve ter no máximo 72 caracteres.',
    );
    expect(signupErrorMessage(new Error('password must be at least 6 characters'))).toBe(
      'A senha deve ter no mínimo 6 caracteres.',
    );
  });

  it('translates an invalid e-mail', () => {
    expect(signupErrorMessage(new Error('email must be a valid email'))).toBe('Email inválido.');
  });

  it('keeps messages it does not know, already in Portuguese', () => {
    expect(signupErrorMessage(new Error('Lote esgotado.'))).toBe('Lote esgotado.');
  });

  it('falls back to the generic message when there is nothing to show', () => {
    expect(signupErrorMessage(new Error(''))).toBe('Erro ao realizar inscrição.');
    expect(signupErrorMessage(undefined)).toBe('Erro ao realizar inscrição.');
  });
});
