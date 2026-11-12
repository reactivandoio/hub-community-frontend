import type { EmailCampaign, EmailCampaignAudience, EmailCampaignStatus, EmailCampaignType } from '@/lib/types';

// E-mail marketing do evento (REA-29): texts and small rules of the admin page. The subjects
// mirror the BFF defaults (services/email/templates/event-campaign.js).

export interface CampaignKind {
  type: EmailCampaignType;
  title: string;
  description: string;
  audience: string;
  adminOnly: boolean;
}

export const CAMPAIGN_KINDS: CampaignKind[] = [
  {
    type: 'invite',
    title: 'Convite para o evento',
    description: 'Convida a base cadastrada no Hub Community com data de nascimento de maior de 18 anos, menos quem já está inscrito.',
    audience: 'Base do Hub',
    adminOnly: true,
  },
  {
    type: 'share',
    title: 'Convide alguém',
    description: 'Cada inscrito com data de nascimento de maior de 18 anos recebe um link pessoal do evento para mandar no WhatsApp, LinkedIn ou copiar.',
    audience: 'Inscritos',
    adminOnly: false,
  },
  {
    type: 'reminder',
    title: 'Lembrete do evento',
    description: 'Lembra os inscritos com data de nascimento de maior de 18 anos da data, do horário e do local.',
    audience: 'Inscritos',
    adminOnly: false,
  },
];

export const campaignKinds = (isAdmin: boolean) => CAMPAIGN_KINDS.filter((kind) => isAdmin || !kind.adminOnly);

export const campaignTitle = (type: EmailCampaignType) =>
  CAMPAIGN_KINDS.find((kind) => kind.type === type)?.title ?? type;

export function defaultSubject(type: EmailCampaignType, eventTitle?: string | null): string {
  const title = eventTitle || 'evento';
  if (type === 'share') return `🤝 Convide alguém para ${title}`;
  if (type === 'reminder') return `⏰ Lembrete: ${title} está chegando`;
  return `📣 Você está convidado: ${title}`;
}

export const STATUS_LABELS: Record<EmailCampaignStatus, string> = {
  draft: 'Rascunho',
  sending: 'Enviando',
  paused: 'Pausada',
  done: 'Concluída',
  canceled: 'Cancelada',
};

export const isActive = (campaign: Pick<EmailCampaign, 'status'>) =>
  campaign.status === 'sending' || campaign.status === 'paused';

/** Share of the audience already handled (sent or failed), 0–100. */
export function progressPercent(campaign: Pick<EmailCampaign, 'sent' | 'failed' | 'total' | 'status'>): number {
  if (campaign.status === 'done') return 100;
  if (!campaign.total) return 0;
  return Math.min(100, Math.round(((campaign.sent + campaign.failed) / campaign.total) * 100));
}

/** "≈ 1.240 pessoas · cerca de 18 dias (70 por dia)" */
export function audienceSummary(audience: EmailCampaignAudience): string {
  const people = `${audience.approximate ? 'até ' : ''}${audience.total.toLocaleString('pt-BR')} ${audience.total === 1 ? 'pessoa' : 'pessoas'}`;
  if (!audience.total || !audience.estimated_days) return people;
  if (audience.estimated_days <= 1) return `${people} · sai hoje`;
  return `${people} · cerca de ${audience.estimated_days} dias (${audience.daily_limit} por dia)`;
}
