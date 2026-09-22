/**
 * Turns a spreadsheet matrix (what `XLSX.utils.sheet_to_json(ws, { header: 1 })`
 * gives) into a header list plus row objects keyed by those same headers.
 *
 * The point is that both sides agree. Reading the headers and the rows through
 * two different paths is what broke the signup import: the header list was
 * trimmed for display while `sheet_to_json`'s object mode kept the raw cell
 * text as keys, so a Google Forms export — whose question labels end in "\n" —
 * mapped every row to an undefined name and the import silently found nobody.
 */

export type SheetRow = Record<string, string>;

export interface SheetTable {
  headers: string[];
  rows: SheetRow[];
}

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/**
 * Trimmed headers, made unique. Two columns whose labels only differ by
 * whitespace would otherwise collapse into one and quietly drop a column, so
 * the repeats get a numeric suffix instead.
 */
function uniqueHeaders(rawHeaders: unknown[]): string[] {
  const seen = new Map<string, number>();

  return rawHeaders.map((raw, index) => {
    const base = text(raw).trim() || `Coluna ${index + 1}`;
    const previous = seen.get(base) ?? 0;
    seen.set(base, previous + 1);
    return previous === 0 ? base : `${base} (${previous + 1})`;
  });
}

export function tableFromMatrix(matrix: unknown[][]): SheetTable {
  const [rawHeaders, ...body] = matrix;
  if (!rawHeaders) return { headers: [], rows: [] };

  const headers = uniqueHeaders(rawHeaders);

  const rows = body
    .map((cells) => {
      const row: SheetRow = {};
      headers.forEach((header, index) => {
        row[header] = text(cells?.[index]).trim();
      });
      return row;
    })
    // A trailing blank line is normal in an exported sheet; it is not a person.
    .filter((row) => headers.some((header) => row[header] !== ''));

  return { headers, rows };
}

/**
 * Picks the header that best matches a field, given the labels that field goes
 * by in the exports we see.
 *
 * An exact label always wins. Otherwise the match with the highest coverage
 * does — how much of the header the matched term accounts for — because a long
 * question that merely mentions a word is rarely that field. A Google Forms
 * sheet asking "Indique um amigo empresário … (Nome, telefone com DDD)" was
 * being read as the attendee's phone, ahead of "Seu número de contato -
 * Celular com DDD", simply because "Telefone" is listed before "Celular".
 */
export function detectColumn(headers: string[], candidates: string[]): string {
  const normalize = (value: string) => value.toLowerCase().trim();

  for (const candidate of candidates) {
    const exact = headers.find((header) => normalize(header) === normalize(candidate));
    if (exact) return exact;
  }

  let best = '';
  let bestCoverage = 0;

  for (const header of headers) {
    const normalizedHeader = normalize(header);
    if (!normalizedHeader) continue;

    for (const candidate of candidates) {
      const normalizedCandidate = normalize(candidate);
      if (!normalizedHeader.includes(normalizedCandidate)) continue;

      const coverage = normalizedCandidate.length / normalizedHeader.length;
      if (coverage > bestCoverage) {
        best = header;
        bestCoverage = coverage;
      }
    }
  }

  return best;
}

/**
 * One row of the `importSignups` mutation. The CPF goes as digits: the BFF keeps
 * it on the participant's HubCommunity account (the signup itself has no field
 * for it). Only send keys `SignupImportInput` declares — an unknown one makes
 * GraphQL reject the whole batch.
 */
export function toSignupImportInput(row: {
  name: string;
  email?: string;
  phone_number?: string;
  cpf?: string;
}) {
  const cpf = (row.cpf || '').replace(/\D/g, '');
  return {
    name: row.name,
    email: row.email || null,
    phone_number: row.phone_number || null,
    cpf: cpf || null,
  };
}
