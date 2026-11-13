import { describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect }));

import CreatePasswordPage from '../page';
import ResetPasswordPage from '../../reset-password/page';

describe('old password links (REA-26: login by code)', () => {
  it('"Crie sua senha" goes to the complete-registration page', () => {
    CreatePasswordPage();
    expect(redirect).toHaveBeenCalledWith('/completar-cadastro');
  });

  it('"Recuperar senha" goes there too', () => {
    redirect.mockClear();
    ResetPasswordPage();
    expect(redirect).toHaveBeenCalledWith('/completar-cadastro');
  });
});
