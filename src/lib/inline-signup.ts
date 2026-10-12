import * as z from 'zod';

/**
 * Guest signup on the event page: no password. The BFF creates the account
 * (password pending) and e-mails the ticket plus a "Crie sua senha" link.
 */
const phoneRegex = /^\+?[\d\s()-]{8,20}$/;

export const inlineSignupSchema = z.object({
  name: z.string().min(3, 'Nome completo deve ter no mínimo 3 caracteres.'),
  email: z.string().email('Email inválido.'),
  phone: z.string().regex(phoneRegex, 'Informe um número válido (ex: +55 11 98765-4321).'),
});

/** REA-22: the same WhatsApp rule wherever the number is typed (signup, profile). */
export function isValidPhone(phone: string | null | undefined): boolean {
  const value = String(phone || '').trim();
  return phoneRegex.test(value) && value.replace(/\D/g, '').length >= 8;
}

export type InlineSignupValues = z.infer<typeof inlineSignupSchema>;

export function cleanSignupPhone(phone: string): string {
  return phone.replace(/[^\d+\s()-]/g, '');
}

export function guestSignupSuccessMessage(email: string): string {
  return `Enviamos seu ingresso e o link para criar sua senha para ${email}`;
}
