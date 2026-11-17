import { describe, expect, it } from 'vitest';

import { duplicateCpfIds, mergeMoveLines, mergeNotes } from '@/lib/admin-user-merge';
import type { AdminMergePreview } from '@/lib/types';

const preview = (over: Partial<AdminMergePreview> = {}): AdminMergePreview => ({
  blockers: [],
  canMerge: true,
  links: [],
  certificatesByEmail: 0,
  requestsByEmail: 0,
  filledFields: [],
  signupsToMove: 0,
  signupConflicts: 0,
  ...over,
});

describe('duplicateCpfIds (REA-96)', () => {
  it('collects every account of every group', () => {
    const user = (id: string) => ({ id, blocked: false, isAdmin: false, isManager: false, signups: 0, certificates: 0, links: 0, linkDetails: [] });
    expect([...duplicateCpfIds([
      { id: '620-621', suggestionReason: '', users: [user('620'), user('621')] },
      { id: '3-5', suggestionReason: '', users: [user('3'), user('5')] },
    ])]).toEqual(['620', '621', '3', '5']);
    expect(duplicateCpfIds(undefined).size).toBe(0);
  });
});

describe('mergeMoveLines', () => {
  it('lists the links, the signups and what was sent to the old e-mail', () => {
    expect(mergeMoveLines(preview({
      links: [{ label: 'Certificados', count: 2 }, { label: 'Votos', count: 0 }],
      signupsToMove: 1,
      certificatesByEmail: 2,
      requestsByEmail: 1,
    }))).toEqual([
      'Certificados: 2',
      '1 inscrição no Eventando passa(m) para o e-mail da conta que fica',
      '2 certificados enviados ao e-mail antigo passa(m) para o novo',
      '1 pedido de certificado do e-mail antigo passa(m) para o novo',
    ]);
    expect(mergeMoveLines(preview())).toEqual([]);
  });
});

describe('mergeNotes', () => {
  it('always says the dropped account is switched off, and warns about conflicts and filled fields', () => {
    const notes = mergeNotes(preview({ signupConflicts: 1, filledFields: ['cpf', 'phone'] }));
    expect(notes[0]).toMatch(/1 inscrição fica no e-mail antigo/);
    expect(notes[1]).toBe('A conta que fica estava sem CPF, WhatsApp; recebe da conta descartada.');
    expect(notes).toContain('A conta descartada é desativada e anonimizada (nada é apagado) e as sessões abertas dela são encerradas.');
  });
});
