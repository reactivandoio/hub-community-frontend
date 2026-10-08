import { describe, it, expect } from 'vitest';
import { activeBatchId } from '../active-batch';

const batch = (id: string, batch_number: number, enabled = true) => ({ id, batch_number, value: 0, enabled });

describe('activeBatchId', () => {
  it('picks the only open batch', () => {
    expect(activeBatchId([{ id: 'p', name: 'Ouvinte', enabled: true, can_be_listed: true, batches: [batch('31', 1)] }])).toBe('31');
  });

  it('picks the lowest-numbered enabled batch', () => {
    const products = [{ id: 'p', name: 'Ingresso', enabled: true, batches: [batch('9', 3), batch('7', 1, false), batch('8', 2)] }];
    expect(activeBatchId(products)).toBe('8');
  });

  it('skips disabled and hidden products', () => {
    const products = [
      { id: 'a', name: 'Importação', enabled: true, can_be_listed: false, batches: [batch('1', 1)] },
      { id: 'b', name: 'Antigo', enabled: false, batches: [batch('2', 1)] },
      { id: 'c', name: 'Ingresso', enabled: true, batches: [batch('3', 2)] },
    ];
    expect(activeBatchId(products)).toBe('3');
  });

  it('is null when there is no open batch', () => {
    expect(activeBatchId([])).toBeNull();
    expect(activeBatchId(undefined)).toBeNull();
    expect(activeBatchId([{ id: 'p', name: 'X', enabled: true, batches: [batch('1', 1, false)] }])).toBeNull();
  });
});
