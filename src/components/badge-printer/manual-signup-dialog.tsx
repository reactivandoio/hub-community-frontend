'use client';

import { useMutation, useQuery } from '@apollo/client';
import { Loader2, Printer, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { activeBatchId } from '@/lib/active-batch';
import { maskBirthDate, parseBirthDate } from '@/lib/birth-date';
import { formatCpf } from '@/lib/certificate';
import { cleanSignupPhone } from '@/lib/inline-signup';
import { EVENT_BATCHES, MANUAL_SIGNUP } from '@/lib/queries';
import type { EventBatchesResponse, ManualSignupResponse } from '@/lib/types';

export type ManualSignupResult = ManualSignupResponse['manualSignup'];

interface Form {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
}

const EMPTY_FORM: Form = { name: '', email: '', phone: '', cpf: '', birthDate: '' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same rule as the public signup form (lib/inline-signup.ts).
const PHONE_RE = /^\+?[\d\s()-]{8,20}$/;

interface ManualSignupDialogProps {
  eventSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with a successful signup; the station checks in and prints from here. */
  onRegistered: (result: ManualSignupResult & { signup: NonNullable<ManualSignupResult['signup']> }) => void;
}

/**
 * Signs a walk-in up on the event's active batch: the same fields as the public
 * signup form (name, e-mail, WhatsApp) plus the CPF and date of birth the account
 * keeps (asked by the profile for certificates), all required. The BFF finds an existing
 * account by CPF, then e-mail, and sends the e-mails.
 */
export function ManualSignupDialog({ eventSlug, open, onOpenChange, onRegistered }: ManualSignupDialogProps) {
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: eventData, loading: loadingBatches } = useQuery<EventBatchesResponse>(EVENT_BATCHES, {
    variables: { slugOrId: eventSlug },
    skip: !eventSlug,
  });
  const batchId = activeBatchId(eventData?.eventBySlugOrId?.products);

  const [manualSignup] = useMutation<ManualSignupResponse>(MANUAL_SIGNUP);

  const set = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const value = field === 'cpf' ? formatCpfInput(raw) : field === 'birthDate' ? maskBirthDate(raw) : raw;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const email = form.email.trim().toLowerCase();
    const cpfDigits = form.cpf.replace(/\D/g, '');
    if (form.name.trim().length < 3) return setError('Informe o nome completo.');
    if (!EMAIL_RE.test(email)) return setError('Informe um e-mail válido.');
    const phone = cleanSignupPhone(form.phone).trim();
    if (!PHONE_RE.test(phone)) return setError('Informe um WhatsApp válido (ex: +55 62 99999-9999).');
    if (cpfDigits.length !== 11) return setError('Informe o CPF com 11 dígitos.');
    const dateOfBirth = parseBirthDate(form.birthDate);
    if (!dateOfBirth) return setError('Informe uma data de nascimento válida (DD/MM/AAAA).');
    if (!batchId) {
      return setError(loadingBatches ? 'Carregando o lote do evento, tente de novo.' : 'Este evento não tem lote ativo para inscrição.');
    }

    setBusy(true);
    try {
      const input = { name: form.name.trim(), email, phone_number: phone, cpf: cpfDigits, date_of_birth: dateOfBirth };
      const { data } = await manualSignup({ variables: { eventSlug, batchId, input } });
      const result = data?.manualSignup;
      if (!result?.success || !result.signup) {
        setError(result?.message || 'Não foi possível inscrever. Tente novamente.');
        return;
      }
      setForm(EMPTY_FORM);
      onRegistered({ ...result, signup: result.signup });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível inscrever. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError('');
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Inscrição Manual
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Inscrição Manual</DialogTitle>
            <DialogDescription>
              Inscreve a pessoa no evento, faz o check-in e imprime o crachá. Se ela já tem conta
              (pelo CPF ou e-mail), a inscrição vai para essa conta.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-name">Nome completo</Label>
              <Input id="manual-name" autoComplete="off" value={form.name} onChange={set('name')} disabled={busy} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-email">E-mail</Label>
              <Input id="manual-email" type="email" autoComplete="off" value={form.email} onChange={set('email')} disabled={busy} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manual-phone">WhatsApp</Label>
                <Input
                  id="manual-phone"
                  inputMode="tel"
                  placeholder="+55 62 99999-9999"
                  value={form.phone}
                  onChange={set('phone')}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-cpf">CPF</Label>
                <Input
                  id="manual-cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={form.cpf}
                  onChange={set('cpf')}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-birth-date">Data de nascimento</Label>
              <Input
                id="manual-birth-date"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                maxLength={10}
                autoComplete="off"
                value={form.birthDate}
                onChange={set('birthDate')}
                disabled={busy}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
              Inscrever e imprimir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Formats while typing: digits only, at most 11, with the dots and dash.
function formatCpfInput(value: string): string {
  return formatCpf(value.replace(/\D/g, '').slice(0, 11));
}
