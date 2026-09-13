import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const titleSchema = z
  .string()
  .min(1, 'Título é obrigatório.')
  .min(2, 'Título deve ter no mínimo 2 caracteres.')
  .max(100, 'Título deve ter no máximo 100 caracteres.');

export const slugSchema = z
  .string()
  .min(1, 'Slug é obrigatório.')
  .min(2, 'Slug deve ter no mínimo 2 caracteres.')
  .max(100, 'Slug deve ter no máximo 100 caracteres.')
  .regex(
    slugRegex,
    'Slug deve conter apenas letras minúsculas, números e hífens.'
  );

export const shortDescriptionSchema = z
  .string()
  .max(200, 'Descrição curta deve ter no máximo 200 caracteres.')
  .optional();

export const fullDescriptionSchema = z
  .string()
  .max(5000, 'Descrição deve ter no máximo 5000 caracteres.')
  .optional();

export const createCommunitySchema = z.object({
  title: titleSchema,
  slug: slugSchema,
  short_description: shortDescriptionSchema,
});

export type CreateCommunityFormValues = z.infer<typeof createCommunitySchema>;

export const editCommunitySchema = z.object({
  title: titleSchema,
  slug: slugSchema,
  short_description: shortDescriptionSchema,
  full_description: fullDescriptionSchema,
  members_quantity: z
    .number()
    .int('Quantidade deve ser um número inteiro.')
    .min(0, 'Quantidade não pode ser negativa.')
    .optional(),
});

export type EditCommunityFormValues = z.infer<typeof editCommunitySchema>;

export function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífen
    .replace(/(^-|-$)+/g, ''); // Remove hífens do início e fim
}
