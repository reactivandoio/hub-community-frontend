// REA-36: pure rules of the age review screen (/admin/usuarios/idade).
import type { AgeReviewUser } from '@/lib/types';

export const MAX_SELECTION = 50;

/** What the "Situação" column says. */
export function ageReviewStatusLabel(user: AgeReviewUser, now: Date = new Date()): string {
  if (user.status === 'minor_blocked') return 'Desativada (menor de idade)';
  if (user.status === 'dob_blocked') return 'Desativada (sem data de nascimento)';
  if (user.blocked) return 'Desativada';
  // REA-60: past the 7 days the account is not deactivated: it still logs in and has to fill the
  // date of birth (18+) and the declaration before using the Hub.
  if (user.status === 'dob_update_required') return 'Pendente de atualização';
  if (user.status === 'dob_requested') {
    if (user.deadline && new Date(user.deadline).getTime() <= now.getTime()) return 'Prazo vencido: ficará pendente de atualização';
    return 'Aguardando a data';
  }
  return 'Sem ação';
}

/** A user without a date can get the request: active and not asked yet. */
export const canRequestDateOfBirth = (user: AgeReviewUser) =>
  !user.blocked && !user.dateOfBirth && user.status !== 'dob_requested' && user.status !== 'dob_update_required';

/** A minor can be deactivated; one already deactivated as a minor can get the e-mail again. */
export const canBlockMinor = (user: AgeReviewUser) => !user.blocked || user.status === 'minor_blocked';

export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—';

/** "1990-04-07" → "07/04/1990". */
export const formatIsoDate = (value: string | null) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
};
