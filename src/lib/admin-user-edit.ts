import { z } from 'zod';

import { isAdult } from '@/lib/birth-date';
import { isValidCpf, normalizeIdentifier } from '@/lib/certificate';
import type { AdminUserProfile } from '@/lib/types';

/**
 * REA-63: the "Editar" of /admin/usuarios/<id>. The BFF (adminUpdateUser) checks everything again;
 * this only catches typos before the round trip and sends just what changed.
 *
 * The CPF is never shown whole (the page has it masked), so its field starts empty: empty keeps the
 * current one, a value replaces it.
 */

export const adminUserEditSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(120, 'O nome pode ter até 120 caracteres.'),
  email: z.string().trim().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.'),
  cpf: z
    .string()
    .trim()
    .refine((value) => !value || isValidCpf(value), 'Informe um CPF válido.'),
  dateOfBirth: z
    .string()
    .refine((value) => !value || isAdult(value), 'É preciso ter 18 anos ou mais.'),
  phone: z.string().trim().max(30, 'Informe um WhatsApp válido.'),
  marketingOptIn: z.boolean(),
});

export type AdminUserEditValues = z.infer<typeof adminUserEditSchema>;

/** What the AdminUserInput of the BFF takes. */
export interface AdminUserInput {
  name?: string;
  email?: string;
  cpf?: string;
  dateOfBirth?: string;
  phone?: string;
  marketingOptIn?: boolean;
}

export function editValuesOf(profile: AdminUserProfile): AdminUserEditValues {
  return {
    name: profile.name || '',
    email: profile.email || '',
    cpf: '',
    dateOfBirth: profile.date_of_birth ? profile.date_of_birth.slice(0, 10) : '',
    phone: profile.phone || '',
    marketingOptIn: Boolean(profile.marketing_opt_in),
  };
}

const sameEmail = (a?: string | null, b?: string | null) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** Only the fields that changed. A date of birth cannot be cleared here (the BFF refuses it). */
export function changedInput(values: AdminUserEditValues, profile: AdminUserProfile): AdminUserInput {
  const before = editValuesOf(profile);
  const input: AdminUserInput = {};
  const name = values.name.trim().replace(/\s+/g, ' ');
  if (name !== before.name) input.name = name;
  if (!sameEmail(values.email, before.email)) input.email = values.email.trim().toLowerCase();
  if (values.cpf.trim()) input.cpf = normalizeIdentifier(values.cpf);
  if (values.dateOfBirth && values.dateOfBirth !== before.dateOfBirth) input.dateOfBirth = values.dateOfBirth;
  if (values.phone.trim() !== before.phone.trim()) input.phone = values.phone.trim();
  if (values.marketingOptIn !== before.marketingOptIn) input.marketingOptIn = values.marketingOptIn;
  return input;
}

/** Lines of the confirmation shown before changing the e-mail. */
export function emailChangeNotes(check: { signupsToMove: number; signupConflicts: number }): string[] {
  const notes = [
    'A pessoa passa a entrar com o código enviado ao novo e-mail.',
    'Todas as sessões abertas da conta serão encerradas.',
  ];
  if (check.signupConflicts > 0) {
    notes.push(
      `${check.signupConflicts} inscrição(ões) ficam no e-mail antigo: o novo e-mail já está inscrito nesses eventos.`,
    );
  }
  return notes;
}
