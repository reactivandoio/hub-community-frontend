/**
 * Labels and small sums for the check-in section of /admin/events/[id]/analytics.
 * The numbers themselves come from the BFF (`eventAnalytics`).
 */
export type SignupOrigin = 'SITE' | 'MANUAL' | 'IMPORT';

export const ORIGIN_LABELS: Record<SignupOrigin, string> = {
  SITE: 'Site / QR',
  MANUAL: 'Cadastro manual',
  IMPORT: 'Planilha',
};

export function absentCount(totalSignups: number, checkedIn: number): number {
  return Math.max(totalSignups - checkedIn, 0);
}

/** "2026-09-25T18:00" → "18h" */
export function hourLabel(bucket: string): string {
  return `${bucket.slice(11, 13)}h`;
}

export function originSummary(byOrigin: { origin: SignupOrigin; count: number }[]): string {
  return byOrigin
    .filter((o) => o.count > 0)
    .map((o) => {
      const label = ORIGIN_LABELS[o.origin];
      return `${o.count} ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
    })
    .join(' · ');
}
