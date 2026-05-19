import { z } from 'zod';

export const dateSchema = z.coerce.date({
  required_error: 'Data é obrigatória.',
  invalid_type_error: 'Data inválida.',
});

export const optionalDateSchema = z.coerce.date().optional().nullable();

export const maxSlotsSchema = z
  .number()
  .int('Número de vagas deve ser inteiro.')
  .min(1, 'Evento deve ter pelo menos 1 vaga.')
  .max(100000, 'Número de vagas muito alto.');

export const createEventSchema = z.object({
  title: z.string().min(2, { message: 'O título deve ter pelo menos 2 caracteres.' }),
  slug: z.string().min(2, { message: 'O slug deve ter pelo menos 2 caracteres.' }),
  start_date: z.string({ required_error: 'A data de início é obrigatória.' }),
  end_date: z.string({ required_error: 'A data de término é obrigatória.' }),
  max_slots: z.coerce.number().min(1, { message: 'O número de vagas deve ser pelo menos 1.' }),
  pixai_token_integration: z.string().optional(),
  is_online: z.boolean().optional(),
  call_link: z.string().optional(),
  description: z.any().optional(),
  location: z.any().optional(),
  communityId: z.string().optional(),
  talks: z.array(z.any()).optional(),
  products: z.array(z.any()).optional(),
});

export type CreateEventFormValues = z.infer<typeof createEventSchema>;

export const editEventSchema = createEventSchema;

export type EditEventFormValues = z.infer<typeof editEventSchema>;

export const talkSchema = z.object({
  title: z.string().min(2, 'O título é obrigatório.'),
  subtitle: z.string().optional(),
  description: z.any().optional(),
  occur_date: z.string().min(1, 'A data é obrigatória.'),
  room_description: z.string().optional(),
  speakerIds: z.array(z.string()).default([]),
});

export type TalkFormValues = z.infer<typeof talkSchema>;

export const speakerSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.'),
  biography: z.any().optional(),
});

export type SpeakerFormValues = z.infer<typeof speakerSchema>;

export const locationSchema = z.object({
  title: z.string().min(2, 'O título deve ter pelo menos 2 caracteres.'),
  region: z.string().min(2, 'A região é obrigatória.'),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  google_maps_url: z.string().url('URL inválida').optional().or(z.literal('')),
  full_address: z.string().min(5, 'O endereço deve ser completo.'),
  city: z.string().min(2, 'A cidade é obrigatória.'),
});

export type LocationFormValues = z.infer<typeof locationSchema>;

export const batchSchema = z.object({
  batch_number: z.coerce.number().min(1, 'Número do lote obrigatório.'),
  value: z.coerce.number().min(0, 'Valor deve ser positivo.'),
  max_quantity: z.coerce.number().min(1, 'Quantidade deve ser informada.').optional(),
  valid_from: z.string().min(1, 'Data de início obrigatória.'),
  valid_until: z.string().min(1, 'Data de fim obrigatória.'),
  enabled: z.boolean().default(true),
  half_price_eligible: z.boolean().default(false),
});

export type BatchFormValues = z.infer<typeof batchSchema>;

export const productSchema = z.object({
  name: z.string().min(2, 'O nome do produto é obrigatório.'),
  enabled: z.boolean().default(true),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const votingSessionSchema = z.object({
  title: z.string().min(2, { message: 'O título deve ter pelo menos 2 caracteres.' }),
  description: z.string().optional(),
  event_id: z.string().optional(),
  status: z.enum(['open', 'closed', 'archived']),
  max_votes_per_user: z.coerce.number().min(1, {
    message: 'O número de votos por usuário deve ser pelo menos 1.',
  }),
});

export type VotingSessionFormValues = z.infer<typeof votingSessionSchema>;

export const votingOptionSchema = z.object({
  name: z.string().min(2, 'O nome é obrigatório.'),
  description: z.string().optional(),
  pitch_order: z.coerce.number().min(1, 'A ordem é obrigatória.'),
});

export type VotingOptionFormValues = z.infer<typeof votingOptionSchema>;
