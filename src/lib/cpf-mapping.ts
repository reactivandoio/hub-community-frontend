/**
 * "Atualizar CPFs" on the import page: a spreadsheet mapped e-mail → CPF goes to
 * the BFF's `updateCpfs`, which writes it on each HubCommunity account.
 */
import { detectColumn, type SheetRow } from './import-sheet';

export type CpfMappingStatus =
  | 'SAVED'
  | 'CREATED'
  | 'UNCHANGED'
  | 'DIFFERENT'
  | 'INVALID'
  | 'CONFLICT'
  | 'FAILED';

export const CPF_STATUS_LABELS: Record<CpfMappingStatus, string> = {
  SAVED: 'CPF gravado',
  CREATED: 'Conta criada e CPF gravado',
  UNCHANGED: 'Já tinha este CPF',
  DIFFERENT: 'Conta já tem outro CPF (não alterado)',
  INVALID: 'E-mail ou CPF inválido',
  CONFLICT: 'E-mail com dois CPFs na planilha',
  FAILED: 'Falhou — tente de novo',
};

export interface CpfMappingColumns {
  email: string;
  cpf: string;
  name: string;
}

export function detectCpfMappingColumns(headers: string[]): CpfMappingColumns {
  return {
    email: detectColumn(headers, ['E-mail', 'Email', 'E-mail do participante']),
    cpf: detectColumn(headers, ['CPF', 'Documento', 'CPF do participante']),
    name: detectColumn(headers, ['Nome completo', 'Nome', 'Nome do participante', 'Participante']),
  };
}

export function cpfMappingRows(rows: SheetRow[], columns: CpfMappingColumns) {
  const cell = (row: SheetRow, column: string) => (column ? String(row[column] ?? '').trim() : '');
  return rows
    .map((row) => ({
      email: cell(row, columns.email),
      cpf: cell(row, columns.cpf),
      name: cell(row, columns.name) || null,
    }))
    .filter((row) => row.email || row.cpf);
}
