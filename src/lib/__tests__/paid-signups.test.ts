import { describe, expect, it } from 'vitest';

import { paidSignupsSubtitle } from '../paid-signups';

describe('paidSignupsSubtitle', () => {
  it('shows the money and the pending charges apart from the count', () => {
    expect(paidSignupsSubtitle(20000, 2)).toBe('R$ 200,00 arrecadados · +2 pendentes');
  });

  it('uses the singular for one pending charge', () => {
    expect(paidSignupsSubtitle(5000, 1)).toBe('R$ 50,00 arrecadados · +1 pendente');
  });

  it('shows only the pending ones when nothing was paid yet', () => {
    expect(paidSignupsSubtitle(0, 3)).toBe('+3 pendentes');
  });

  it('is empty without money nor pending, or on an older BFF without the field', () => {
    expect(paidSignupsSubtitle(0, 0)).toBeUndefined();
    expect(paidSignupsSubtitle(0, undefined)).toBeUndefined();
    expect(paidSignupsSubtitle(1000, null)).toBe('R$ 10,00 arrecadados');
  });
});
