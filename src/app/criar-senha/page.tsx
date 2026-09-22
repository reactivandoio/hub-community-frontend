'use client';

import {
  CREATE_PASSWORD_COPY,
  PasswordCodeForm,
} from '@/components/auth/password-code-form';

/** Linked from the signup confirmation e-mail: first password for a passwordless signup. */
export default function CreatePasswordPage() {
  return <PasswordCodeForm copy={CREATE_PASSWORD_COPY} />;
}
