import { describe, it, expect } from 'vitest';
import { CPF_STATUS_LABELS, cpfMappingRows, detectCpfMappingColumns } from '../cpf-mapping';

describe('detectCpfMappingColumns', () => {
  it('finds e-mail, CPF and name in a Google Forms export', () => {
    const headers = [
      'Carimbo de data/hora',
      'Seu nome completo:',
      'Seu CPF:',
      'Seu número de contato - Celular com DDD',
      'Seu E-mail',
      'Indique um amigo empresário para ser convidado (Nome, telefone com DDD)',
    ];
    expect(detectCpfMappingColumns(headers)).toEqual({
      email: 'Seu E-mail',
      cpf: 'Seu CPF:',
      name: 'Seu nome completo:',
    });
  });
});

describe('cpfMappingRows', () => {
  it('builds one row per sheet line with e-mail or CPF, name optional', () => {
    const rows = cpfMappingRows(
      [
        { 'Seu E-mail': ' ana@x.io ', 'Seu CPF:': '123.456.789-09', Nome: 'Ana' },
        { 'Seu E-mail': '', 'Seu CPF:': '', Nome: '' },
        { 'Seu E-mail': 'bia@x.io', 'Seu CPF:': '', Nome: 'Bia' },
      ],
      { email: 'Seu E-mail', cpf: 'Seu CPF:', name: '' },
    );
    expect(rows).toEqual([
      { email: 'ana@x.io', cpf: '123.456.789-09', name: null },
      { email: 'bia@x.io', cpf: '', name: null },
    ]);
  });
});

describe('CPF_STATUS_LABELS', () => {
  it('names every status the BFF answers', () => {
    expect(Object.keys(CPF_STATUS_LABELS).sort()).toEqual(
      ['CONFLICT', 'CREATED', 'DIFFERENT', 'FAILED', 'INVALID', 'SAVED', 'UNCHANGED'],
    );
  });
});
