import { isValidCpf } from '@/lib/certificate';
import { isValidPhone } from '@/lib/inline-signup';
import type { User } from '@/lib/types';

// REA-22: WhatsApp too — a finished registration (for the certificate) has CPF, date of
// birth and WhatsApp; the BFF checks the same before issuing.
export type CertificateField = 'name' | 'cpf' | 'date_of_birth' | 'phone';

/** Form order; also the order fields are reported in. */
export const CERTIFICATE_FIELDS: CertificateField[] = ['name', 'cpf', 'date_of_birth', 'phone'];

/**
 * Which of the data required to issue a certificate the profile still lacks.
 * A CPF that fails the check digits counts as missing.
 */
export function missingCertificateFields(
  user: Pick<User, 'name' | 'cpf' | 'date_of_birth' | 'phone'>,
): CertificateField[] {
  const present: Record<CertificateField, boolean> = {
    name: Boolean(user.name?.trim()),
    cpf: Boolean(user.cpf && isValidCpf(user.cpf)),
    date_of_birth: Boolean(user.date_of_birth?.trim()),
    phone: isValidPhone(user.phone),
  };
  return CERTIFICATE_FIELDS.filter((field) => !present[field]);
}
