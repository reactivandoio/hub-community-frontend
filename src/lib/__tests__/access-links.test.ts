import { describe, expect, it } from 'vitest';

import { accessMismatch } from '../access-links';

describe('accessMismatch (REA-48)', () => {
  it('is fine when the role matches what the person is linked to', () => {
    expect(accessMismatch('admin', 0, 0)).toBeNull();
    expect(accessMismatch('community-manager', 2, 0)).toBeNull();
    expect(accessMismatch('event-manager', 0, 1)).toBeNull();
    expect(accessMismatch('authenticated', 0, 0)).toBeNull();
  });

  it('warns about a role without links (it sees nothing)', () => {
    expect(accessMismatch('community-manager', 0, 0)).toMatch(/sem comunidade nem evento/);
    expect(accessMismatch('community-manager', 0, 1)).toMatch(/só vê os eventos que gere/);
    expect(accessMismatch('event-manager', 0, 0)).toMatch(/Event Manager sem evento/);
  });

  it('warns about links the role does not open', () => {
    expect(accessMismatch('authenticated', 1, 0)).toMatch(/mude para Community Manager/);
    expect(accessMismatch('authenticated', 0, 1)).toMatch(/mude para Event Manager/);
    expect(accessMismatch('event-manager', 1, 1)).toMatch(/mude para Community Manager/);
  });
});
