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
