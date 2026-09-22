/**
 * The BFF forwards Strapi's register errors as they come — in English. Show
 * the ones a person can fix in Portuguese; anything else passes through.
 */
const FALLBACK = 'Erro ao realizar inscrição.';

const KNOWN: Array<[RegExp, string]> = [
  [/less than 73 bytes/i, 'A senha deve ter no máximo 72 caracteres.'],
  [/password must be at least/i, 'A senha deve ter no mínimo 6 caracteres.'],
  [/email must be a valid email/i, 'Email inválido.'],
];

export function signupErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (!message) return FALLBACK;
  const known = KNOWN.find(([pattern]) => pattern.test(message));
  return known ? known[1] : message;
}
