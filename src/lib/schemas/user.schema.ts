import { z } from 'zod';

const phoneRegex = /^\+?[\d\s()-]{8,20}$/;

export function isValidCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  const cleaned = cpf.replace(/\D/g, '');

  // CPF deve ter 11 dígitos
  if (cleaned.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

export const fullNameSchema = z
  .string()
  .min(1, 'Nome é obrigatório.')
  .min(3, 'Nome deve ter no mínimo 3 caracteres.')
  .max(100, 'Nome deve ter no máximo 100 caracteres.');

export const phoneSchema = z
  .string()
  .min(1, 'Telefone é obrigatório.')
  .regex(
    phoneRegex,
    'Informe um número válido com código do país (ex: +55 11 98765-4321).'
  );

export const optionalPhoneSchema = z
  .string()
  .regex(phoneRegex, 'Número de telefone inválido.')
  .optional()
  .or(z.literal(''));

export const cpfSchema = z
  .string()
  .min(1, 'CPF é obrigatório.')
  .refine(isValidCPF, 'CPF inválido.');

export const userProfileSchema = z.object({
  fullName: fullNameSchema,
  email: z.string().email('Email inválido.'),
  phone: optionalPhoneSchema,
  bio: z.string().max(500, 'Biografia deve ter no máximo 500 caracteres.').optional(),
});

export type UserProfileFormValues = z.infer<typeof userProfileSchema>;

export const eventRegistrationSchema = z.object({
  fullName: fullNameSchema,
  email: z.string().min(1, 'Email é obrigatório.').email('Email inválido.'),
  phone: phoneSchema,
});

export type EventRegistrationFormValues = z.infer<typeof eventRegistrationSchema>;

/**
 * Schema para busca de certificado
 */
export const certificateSearchSchema = z.object({
  identifier: cpfSchema,
  email: z.string().email('Email inválido.').optional(),
  phone_number: optionalPhoneSchema,
});

export type CertificateSearchFormValues = z.infer<typeof certificateSearchSchema>;

// Exporta a função de validação de CPF para uso externo
export { isValidCPF };
