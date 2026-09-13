import { isValidCpf } from '@/lib/certificate';
import type { User } from '@/lib/types';

export type CertificateField = 'name' | 'cpf' | 'date_of_birth';

/** Form order; also the order fields are reported in. */
export const CERTIFICATE_FIELDS: CertificateField[] = ['name', 'cpf', 'date_of_birth'];

/**
 * Which of the data required to issue a certificate the profile still lacks.
 * A CPF that fails the check digits counts as missing.
 */
export function missingCertificateFields(
  user: Pick<User, 'name' | 'cpf' | 'date_of_birth'>,
): CertificateField[] {
  const present: Record<CertificateField, boolean> = {
    name: Boolean(user.name?.trim()),
    cpf: Boolean(user.cpf && isValidCpf(user.cpf)),
    date_of_birth: Boolean(user.date_of_birth?.trim()),
  };
  return CERTIFICATE_FIELDS.filter((field) => !present[field]);
}
