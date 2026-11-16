// REA-59: the admin's "E-mails agendados" page. Pure labels and numbers, tested.
import type { AdminEmailUsage, AdminQueuedCampaign } from '@/lib/types';

const WEEKDAYS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];

/** "2026-11-17" → "ter., 17/11" (the date is already a São Paulo calendar day). */
export function formatQueueDay(ymd: string | null | undefined, todayYmd?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  if (!match) return '—';
  if (todayYmd && ymd === todayYmd) return `hoje, ${match[3]}/${match[2]}`;
  const weekday = WEEKDAYS[new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])).getUTCDay()];
  return `${weekday}, ${match[3]}/${match[2]}`;
}

/** Today in São Paulo as YYYY-MM-DD. */
export function todaySaoPaulo(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function percentOf(used: number, limit: number | null | undefined): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/** "Hoje: 120 de 300 · Mês: 1.540 de 3.000" style lines. */
export function usageLines(usage: AdminEmailUsage): { today: string; month: string; campaigns: string } {
  const n = (v: number) => v.toLocaleString('pt-BR');
  return {
    today: `${n(usage.sent_today)} de ${n(usage.daily_limit)} hoje`,
    month: usage.monthly_limit === null
      ? `${n(usage.sent_this_month)} no mês (sem limite mensal)`
      : `${n(usage.sent_this_month)} de ${n(usage.monthly_limit)} no mês`,
    campaigns: `As campanhas ainda podem enviar ${n(usage.campaigns_left_today)} hoje (${n(usage.reserve)} ficam reservados para códigos de login e confirmações).`,
  };
}

/** The forecast of one campaign, in words. */
export function finishLabel(
  campaign: Pick<AdminQueuedCampaign, 'status' | 'remaining' | 'finish_date'>,
  { enabled, todayYmd }: { enabled: boolean; todayYmd?: string },
): string {
  if (campaign.remaining <= 0) return 'Terminando';
  if (campaign.status === 'paused') return 'Pausada: sem previsão';
  if (!enabled) return 'Envio desligado no servidor';
  if (!campaign.finish_date) return 'Além de 120 dias';
  return `Termina ${formatQueueDay(campaign.finish_date, todayYmd)}`;
}
