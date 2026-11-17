// REA-96: joining two accounts of the same person (admin only). Pure: the lines the confirmation
// shows and who is in a duplicate CPF group, read by the screens and tested. The BFF checks
// everything again.

import type { AdminDuplicateCpfGroup, AdminMergePreview } from '@/lib/types';

const FIELD_LABELS: Record<string, string> = {
  name: 'nome',
  cpf: 'CPF',
  phone: 'WhatsApp',
  date_of_birth: 'data de nascimento',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The ids of every account that shares its CPF with another one. */
export function duplicateCpfIds(groups: AdminDuplicateCpfGroup[] | null | undefined): Set<string> {
  return new Set((groups || []).flatMap((group) => group.users.map((user) => user.id)));
}

/** What joining moves, one line each, in the admin's words. */
export function mergeMoveLines(preview: AdminMergePreview): string[] {
  const lines = preview.links
    .filter((link) => link.count > 0)
    .map((link) => `${link.label}: ${link.count}`);
  if (preview.signupsToMove > 0) {
    lines.push(`${plural(preview.signupsToMove, 'inscrição', 'inscrições')} no Eventando passa(m) para o e-mail da conta que fica`);
  }
  if (preview.certificatesByEmail > 0) {
    lines.push(`${plural(preview.certificatesByEmail, 'certificado enviado', 'certificados enviados')} ao e-mail antigo passa(m) para o novo`);
  }
  if (preview.requestsByEmail > 0) {
    lines.push(`${plural(preview.requestsByEmail, 'pedido', 'pedidos')} de certificado do e-mail antigo passa(m) para o novo`);
  }
  return lines;
}

/** What else happens, always shown before confirming. */
export function mergeNotes(preview: AdminMergePreview): string[] {
  const notes: string[] = [];
  if (preview.signupConflicts > 0) {
    notes.push(`${plural(preview.signupConflicts, 'inscrição fica', 'inscrições ficam')} no e-mail antigo: a conta que fica já está inscrita no mesmo evento. O pagamento não muda.`);
  }
  if (preview.filledFields.length > 0) {
    const fields = preview.filledFields.map((field) => FIELD_LABELS[field] || field).join(', ');
    notes.push(`A conta que fica estava sem ${fields}; recebe da conta descartada.`);
  }
  notes.push('A conta descartada é desativada e anonimizada (nada é apagado) e as sessões abertas dela são encerradas.');
  notes.push('A junção fica registrada no histórico, sem dados pessoais. Não dá para desfazer pela tela.');
  return notes;
}
