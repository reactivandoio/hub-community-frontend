import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

// The admin voting screens used to write to Strapi with anonymous fetch calls, so anyone
// could create, change or delete a session. They now go through the BFF, which checks
// the admin role. Keep any direct Strapi call out of them.
const ADMIN_VOTING_FILES = [
  'src/app/admin/voting-sessions/page.tsx',
  'src/app/admin/voting-sessions/new/page.tsx',
  'src/app/admin/voting-sessions/[id]/page.tsx',
  'src/components/admin/voting-session-form.tsx',
  'src/components/admin/voting-option-form-dialog.tsx',
];

describe('admin voting screens', () => {
  it.each(ADMIN_VOTING_FILES)('%s does not call Strapi directly', (file) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    expect(source).not.toMatch(/\/api\/voting-(sessions|options)/);
    expect(source).not.toMatch(/fetch\(/);
  });
});
