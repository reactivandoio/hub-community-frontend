import { describe, it, expect } from 'vitest';
import { detectColumn, tableFromMatrix, toSignupImportInput } from '../import-sheet';

describe('tableFromMatrix', () => {
  it('keys the rows by the same trimmed headers the mapping uses', () => {
    // A Google Forms export: every question label ends in a newline. Trimming
    // the headers for the mapping while keying the rows by the raw label is
    // what made the signup import find zero people.
    const { headers, rows } = tableFromMatrix([
      ['Carimbo de data/hora', 'Seu nome completo:\n', 'Seu E-mail'],
      ['46266.7', 'Ana Souza ', 'ana@x.io'],
    ]);

    expect(headers).toEqual(['Carimbo de data/hora', 'Seu nome completo:', 'Seu E-mail']);
    expect(rows[0]['Seu nome completo:']).toBe('Ana Souza');
    expect(rows[0]['Seu E-mail']).toBe('ana@x.io');
  });

  it('reads numeric cells as text, so a CPF or phone survives', () => {
    const { rows } = tableFromMatrix([
      ['CPF', 'Celular'],
      [76924424104, 62984026819],
    ]);

    expect(rows[0].CPF).toBe('76924424104');
    expect(rows[0].Celular).toBe('62984026819');
  });

  it('keeps both columns when two labels differ only by whitespace', () => {
    const { headers } = tableFromMatrix([['Nome', 'Nome '], ['a', 'b']]);
    expect(headers).toEqual(['Nome', 'Nome (2)']);
  });

  it('drops the blank trailing rows an export leaves behind', () => {
    const { rows } = tableFromMatrix([
      ['Nome', 'E-mail'],
      ['Ana', 'ana@x.io'],
      ['', ''],
      [],
    ]);

    expect(rows).toHaveLength(1);
  });

  it('names an unlabelled column instead of collapsing it', () => {
    const { headers } = tableFromMatrix([['Nome', ''], ['Ana', 'x']]);
    expect(headers).toEqual(['Nome', 'Coluna 2']);
  });

  it('is empty for an empty sheet', () => {
    expect(tableFromMatrix([])).toEqual({ headers: [], rows: [] });
  });
});

describe('detectColumn', () => {
  // The header row of a real Google Forms export (ALI Produtividade).
  const FORMS_HEADERS = [
    'Carimbo de data/hora',
    'Seu nome completo:',
    'Seu CPF:',
    'Seu número de contato - Celular com DDD',
    'Seu E-mail',
    'Nome da sua empresa:',
    'Nome do seu ALI - Agente Local de Inovação:',
    'Gostaria de expor algum dos seus produtos/banner no local do evento?',
    'Indique um amigo empresário para ser convidado a participar do próximo Ciclo do Programa ALI. (Nome, telefone com DDD)',
  ];

  it('takes the attendee phone, not the question that merely says "telefone"', () => {
    expect(detectColumn(FORMS_HEADERS, ['Telefone', 'Celular', 'phone', 'WhatsApp'])).toBe(
      'Seu número de contato - Celular com DDD',
    );
  });

  it('takes the attendee name, not the company name', () => {
    expect(detectColumn(FORMS_HEADERS, ['Nome', 'Nome Completo', 'name'])).toBe('Seu nome completo:');
  });

  it('finds the e-mail and the CPF', () => {
    expect(detectColumn(FORMS_HEADERS, ['E-mail', 'Email'])).toBe('Seu E-mail');
    expect(detectColumn(FORMS_HEADERS, ['CPF', 'Documento'])).toBe('Seu CPF:');
  });

  it('prefers an exact label over any fuzzy match', () => {
    expect(detectColumn(['Nome do participante', 'Nome'], ['Nome'])).toBe('Nome');
  });

  it('returns empty when nothing matches', () => {
    expect(detectColumn(['Coluna A', 'Coluna B'], ['Nome'])).toBe('');
  });
});

describe('toSignupImportInput', () => {
  it('sends the CPF as digits, and null when the sheet has none', () => {
    expect(
      toSignupImportInput({ name: 'Ana', email: 'ana@x.io', phone_number: '62', cpf: '071.234.567-89' }),
    ).toEqual({ name: 'Ana', email: 'ana@x.io', phone_number: '62', cpf: '07123456789' });
    expect(toSignupImportInput({ name: 'Bia', email: '', phone_number: '', cpf: '' })).toEqual({
      name: 'Bia',
      email: null,
      phone_number: null,
      cpf: null,
    });
  });
});
