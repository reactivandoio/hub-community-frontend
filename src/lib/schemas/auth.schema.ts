import { z } from 'zod';

export const emailSchema = z
  .string()
  .min(1, 'Email é obrigatório.')
  .email('Email inválido.');

export const usernameSchema = z
  .string()
  .min(3, 'Username deve ter no mínimo 3 caracteres.')
  .max(30, 'Username deve ter no máximo 30 caracteres.')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username pode conter apenas letras, números e _');

// REA-26: login by a code sent to the e-mail (no password).
export const loginEmailSchema = z.object({
  email: emailSchema,
});

export type LoginEmailFormValues = z.infer<typeof loginEmailSchema>;

export const loginCodeSchema = z.object({
  code: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 6, 'Digite os 6 números do código.'),
});

export type LoginCodeFormValues = z.input<typeof loginCodeSchema>;
