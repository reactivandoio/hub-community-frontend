'use client';

import {
  PasswordCodeForm,
  RESET_PASSWORD_COPY,
} from '@/components/auth/password-code-form';

export default function ResetPasswordPage() {
  return <PasswordCodeForm copy={RESET_PASSWORD_COPY} />;
}
