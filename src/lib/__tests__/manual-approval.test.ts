import { describe, expect, it } from 'vitest';

import {
  approvalReasonLabel,
  approvalWarningLabel,
  canApproveSignup,
  manualApprovalNote,
} from '../manual-approval';

describe('canApproveSignup (REA-34)', () => {
  it('allows a pending, expired or canceled charge', () => {
    for (const payment_status of ['PEDING_PAYMENT', 'EXPIRED', 'CANCELED']) {
      expect(canApproveSignup({ signup_id: '1', payment_status })).toBe(true);
    }
  });

  it('never a refunded, a confirmed or an already approved one', () => {
    expect(canApproveSignup({ signup_id: '1', payment_status: 'REFUND' })).toBe(false);
    expect(canApproveSignup({ signup_id: '1', payment_status: 'CONFIRMED' })).toBe(false);
    expect(canApproveSignup({ signup_id: '1', payment_status: 'EXPIRED', manual_approved: true })).toBe(false);
  });

  it('not a signup without payment, nor one the BFF sent without an id', () => {
    expect(canApproveSignup({ signup_id: '1', payment_status: null })).toBe(false);
    expect(canApproveSignup({ payment_status: 'EXPIRED' })).toBe(false);
  });
});

describe('manualApprovalNote', () => {
  it('says who approved and when, in Brasília time', () => {
    expect(
      manualApprovalNote({ manual_approved_by: 'Pedro', manual_approved_at: '2026-11-10T15:30:00.000Z' }),
    ).toBe('por Pedro em 10/11/2026 12:30');
  });

  it('leaves out what is missing', () => {
    expect(manualApprovalNote({ manual_approved_by: 'Pedro' })).toBe('por Pedro');
    expect(manualApprovalNote({ manual_approved_at: '2026-11-10T15:30:00.000Z' })).toBe('em 10/11/2026 12:30');
    expect(manualApprovalNote({})).toBe('');
    expect(manualApprovalNote({ manual_approved_at: 'not a date' })).toBe('');
  });
});

describe('approval texts', () => {
  it('explains each warning', () => {
    expect(approvalWarningLabel('BATCH_FULL')).toMatch(/lote/);
    expect(approvalWarningLabel('EVENT_FULL')).toMatch(/evento/);
    expect(approvalWarningLabel('COUPON_EXHAUSTED')).toMatch(/cupom/);
    expect(approvalWarningLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('explains why a signup cannot be approved', () => {
    expect(approvalReasonLabel('REFUNDED')).toMatch(/reembolsad/);
    expect(approvalReasonLabel('ALREADY_CONFIRMED')).toMatch(/confirmada/);
    expect(approvalReasonLabel('ALREADY_APPROVED')).toMatch(/aprovada/);
    expect(approvalReasonLabel('NO_PAYMENT')).toMatch(/sem pagamento/);
    expect(approvalReasonLabel('NOT_FOUND')).toMatch(/não encontrada/);
    expect(approvalReasonLabel(null)).toMatch(/não pode ser aprovada/);
  });
});
