'use client';

import { useMutation, useQuery } from '@apollo/client';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { formatCpf, isValidCpf, normalizeIdentifier } from '@/lib/certificate';
import { missingCertificateFields, type CertificateField } from '@/lib/profile-completeness';
import { ME, UPDATE_PROFILE } from '@/lib/queries';
import type { User } from '@/lib/types';

interface MeData {
  me: Pick<User, 'id' | 'username' | 'email' | 'name' | 'phone' | 'cpf' | 'date_of_birth'> | null;
}

type Values = Record<CertificateField, string>;
type Errors = Partial<Record<CertificateField, string>>;

const EMPTY: Values = { name: '', cpf: '', date_of_birth: '' };

function validate(values: Values, fields: CertificateField[]): Errors {
  const errors: Errors = {};
  if (fields.includes('name') && values.name.trim().length < 3) {
    errors.name = 'Informe seu nome completo.';
  }
  if (fields.includes('cpf') && !isValidCpf(values.cpf)) {
    errors.cpf = 'CPF inválido.';
  }
  if (fields.includes('date_of_birth')) {
    const date = new Date(`${values.date_of_birth}T00:00:00`);
    if (!values.date_of_birth || Number.isNaN(date.getTime()) || date > new Date()) {
      errors.date_of_birth = 'Informe uma data de nascimento válida.';
    }
  }
  return errors;
}

/**
 * Blocks the app for logged-in users until the data needed to issue a certificate
 * (full name, CPF, date of birth) is on their profile. Mounted once in the root layout.
 *
 * The stored session may be stale (older sessions never saved these fields), so the
 * server profile is synced first and the dialog only opens for what is still missing.
 */
export function CompleteProfileModal() {
  const { isAuthenticated, isLoading, user, syncUser } = useAuth();
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState('');

  const storedMissing = user ? missingCertificateFields(user) : [];
  const shouldCheck = isAuthenticated && !isLoading && !!user && storedMissing.length > 0;
  const checked = !!user && checkedFor === user.email;

  useQuery<MeData>(ME, {
    skip: !shouldCheck || checked,
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      const me = data?.me;
      if (me) {
        const fresh: Partial<User> = {};
        if (me.name) fresh.name = me.name;
        if (me.cpf) fresh.cpf = me.cpf;
        if (me.date_of_birth) fresh.date_of_birth = me.date_of_birth;
        if (Object.keys(fresh).length > 0) syncUser?.(fresh);
      }
      setCheckedFor(user?.email ?? null);
    },
    // Can't confirm with the server: ask for whatever the session says is missing.
    onError: () => setCheckedFor(user?.email ?? null),
  });

  const [updateProfile, { loading: saving }] = useMutation(UPDATE_PROFILE);

  const missing = checked && user ? missingCertificateFields(user) : [];
  const open = missing.length > 0;

  const setValue = (field: CertificateField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const nextErrors = validate(values, missing);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input: Partial<User> = {};
    if (missing.includes('name')) input.name = values.name.trim();
    if (missing.includes('cpf')) input.cpf = normalizeIdentifier(values.cpf);
    if (missing.includes('date_of_birth')) input.date_of_birth = values.date_of_birth;

    try {
      await updateProfile({ variables: { input } });
      syncUser?.(input);
      setValues(EMPTY);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Complete seu cadastro</DialogTitle>
          <DialogDescription>
            Precisamos desses dados para emitir seu certificado de participação nos eventos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {missing.includes('name') && (
            <div className="space-y-2">
              <Label htmlFor="complete-profile-name">Nome completo</Label>
              <Input
                id="complete-profile-name"
                autoComplete="name"
                value={values.name}
                onChange={(e) => setValue('name', e.target.value)}
                disabled={saving}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
          )}

          {missing.includes('cpf') && (
            <div className="space-y-2">
              <Label htmlFor="complete-profile-cpf">CPF</Label>
              <Input
                id="complete-profile-cpf"
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
                value={values.cpf}
                onChange={(e) => setValue('cpf', formatCpf(e.target.value))}
                disabled={saving}
              />
              {errors.cpf && <p className="text-sm text-destructive">{errors.cpf}</p>}
            </div>
          )}

          {missing.includes('date_of_birth') && (
            <div className="space-y-2">
              <Label htmlFor="complete-profile-dob">Data de nascimento</Label>
              <Input
                id="complete-profile-dob"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={values.date_of_birth}
                onChange={(e) => setValue('date_of_birth', e.target.value)}
                disabled={saving}
              />
              {errors.date_of_birth && (
                <p className="text-sm text-destructive">{errors.date_of_birth}</p>
              )}
            </div>
          )}

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
