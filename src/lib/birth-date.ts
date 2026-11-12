// Typed "DD/MM/AAAA" date of birth. Same rules as the BFF (resolvers/Certificate/birthdate.js):
// a real calendar day, not in the future, from 1900 on.

export const MIN_BIRTH_YEAR = 1900;

/** Formats while typing: digits only, at most 8, with the slashes ("07041990" → "07/04/1990"). */
export function maskBirthDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "DD/MM/AAAA" → "YYYY-MM-DD", or null when it is not a valid date of birth. */
export function parseBirthDate(value: string, now: Date = new Date()): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < MIN_BIRTH_YEAR) return null;

  // Date.UTC rolls 31/02 over into March, so a round-trip is what proves the day exists.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  if (date.getTime() > now.getTime()) return null;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

// REA-36: the Hub is for people aged 18 or more. Ages count calendar days in São Paulo (no DST
// since 2019: UTC-3), the same rule as the BFF (utils/age) and the backend (utils/age.ts).
export const MIN_AGE = 18;
export const MINOR_MESSAGE = 'É preciso ter 18 anos ou mais.';
export const ADULT_DECLARATION_LABEL = 'Declaro que tenho 18 anos ou mais.';
export const ADULT_DECLARATION_REQUIRED = 'Confirme que você tem 18 anos ou mais.';

const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Age in whole years of an ISO "YYYY-MM-DD" date, or null when it is not one. */
export function ageOn(isoDate: string | null | undefined, now: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate || '').trim());
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const local = new Date(now.getTime() - SAO_PAULO_OFFSET_MS);
  const ty = local.getUTCFullYear();
  const tm = local.getUTCMonth() + 1;
  const td = local.getUTCDate();
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age;
}

/** True for an ISO date of someone aged 18 or more. */
export function isAdult(isoDate: string | null | undefined, now: Date = new Date()): boolean {
  const age = ageOn(isoDate, now);
  return age !== null && age >= MIN_AGE;
}
/** Wording of the box when the staff ticks it at the door (credenciamento manual). */
export const STAFF_ADULT_DECLARATION_LABEL = 'A pessoa declarou que tem 18 anos ou mais.';
