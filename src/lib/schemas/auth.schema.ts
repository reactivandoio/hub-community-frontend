import { z } from 'zod';

const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export const emailSchema = z
  .string()
  .min(1, 'Email é obrigatório.')
  .email('Email inválido.');

export const passwordSchema = z
  .string()
  .min(1, 'Senha é obrigatória.')
  .min(6, 'Senha deve ter no mínimo 6 caracteres.');

export const strongPasswordSchema = z
  .string()
  .min(1, 'Senha é obrigatória.')
  .min(8, 'Senha deve ter no mínimo 8 caracteres.')
  .regex(
    passwordRegex,
    'Senha deve conter pelo menos 1 letra maiúscula e 1 número.'
  );

export const usernameSchema = z
  .string()
  .min(3, 'Username deve ter no mínimo 3 caracteres.')
  .max(30, 'Username deve ter no máximo 30 caracteres.')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username pode conter apenas letras, números e _');

export const signInSchema = z.object({
  identifier: z.string().min(1, 'Email ou username é obrigatório.'),
  password: passwordSchema,
});

export type SignInFormValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres.'),
  password: strongPasswordSchema,
  phone: z.string().optional(),
});

export type SignUpFormValues = z.infer<typeof signUpSchema>;

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: strongPasswordSchema,
    confirmNewPassword: z.string().min(1, 'Confirmação de senha é obrigatória.'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmNewPassword'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
