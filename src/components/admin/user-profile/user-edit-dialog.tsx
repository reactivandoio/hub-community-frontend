'use client';

import { useApolloClient, useMutation } from '@apollo/client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  adminUserEditSchema,
  changedInput,
  editValuesOf,
  emailChangeNotes,
  type AdminUserEditValues,
  type AdminUserInput,
} from '@/lib/admin-user-edit';
import { ADMIN_CHECK_USER_EMAIL, ADMIN_UPDATE_USER, ADMIN_USER_PROFILE } from '@/lib/queries';
import type { AdminEmailCheck, AdminUserProfile, AdminUserUpdateResult } from '@/lib/types';

interface PendingEmailChange {
  input: AdminUserInput;
  check: AdminEmailCheck;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Tente de novo em instantes.');

/**
 * REA-63: "Editar" of /admin/usuarios/<id> — the admin corrects name, e-mail, CPF, date of birth,
 * WhatsApp and the opt-in. Changing the e-mail asks first (the BFF says whether it is free and how
 * many signups move) and ends the person's sessions; the BFF checks everything again.
 */
export function UserEditDialog({ profile }: { profile: AdminUserProfile }) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<PendingEmailChange | null>(null);
  const [moveSignups, setMoveSignups] = useState(true);
  const client = useApolloClient();
  const { toast } = useToast();

  const [updateUser, { loading: saving }] = useMutation<{ adminUpdateUser: AdminUserUpdateResult }>(ADMIN_UPDATE_USER, {
    refetchQueries: [{ query: ADMIN_USER_PROFILE, variables: { userId: profile.id } }],
    awaitRefetchQueries: true,
  });

  const form = useForm<AdminUserEditValues>({
    resolver: zodResolver(adminUserEditSchema),
    defaultValues: editValuesOf(profile),
  });

  const openDialog = (next: boolean) => {
    if (next) form.reset(editValuesOf(profile));
    setPending(null);
    setMoveSignups(true);
    setOpen(next);
  };

  const save = async (input: AdminUserInput, move: boolean) => {
    try {
      const { data } = await updateUser({ variables: { userId: profile.id, input, moveSignups: move } });
      const result = data?.adminUpdateUser;
      toast({ title: 'Cadastro atualizado', description: result?.message });
      openDialog(false);
    } catch (err) {
      setPending(null);
      toast({ variant: 'destructive', title: 'Não foi possível salvar', description: errorMessage(err) });
    }
  };

  const onSubmit = async (values: AdminUserEditValues) => {
    const input = changedInput(values, profile);
    if (Object.keys(input).length === 0) {
      toast({ title: 'Nada para alterar' });
      openDialog(false);
      return;
    }
    if (!input.email) {
      await save(input, false);
      return;
    }
    setChecking(true);
    try {
      const { data } = await client.query<{ adminCheckUserEmail: AdminEmailCheck }>({
        query: ADMIN_CHECK_USER_EMAIL,
        variables: { userId: profile.id, email: input.email },
        fetchPolicy: 'network-only',
      });
      const check = data.adminCheckUserEmail;
      if (!check.available) {
        form.setError('email', { message: check.message || 'Este e-mail não pode ser usado.' });
        return;
      }
      setMoveSignups(true);
      setPending({ input, check });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível conferir o e-mail', description: errorMessage(err) });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <Button variant="outline" onClick={() => openDialog(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </Button>
      <DialogContent className="sm:max-w-[560px]">
        {pending ? (
          <>
            <DialogHeader>
              <DialogTitle>Trocar o e-mail?</DialogTitle>
              <DialogDescription>
                De <strong className="break-all">{profile.email || '—'}</strong> para{' '}
                <strong className="break-all">{pending.input.email}</strong>.
              </DialogDescription>
            </DialogHeader>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {emailChangeNotes(pending.check).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            {pending.check.signupsToMove > 0 ? (
              <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                <Checkbox
                  checked={moveSignups}
                  onCheckedChange={(value) => setMoveSignups(value === true)}
                  aria-label="Passar as inscrições para o novo e-mail"
                />
                <span>
                  Passar {pending.check.signupsToMove === 1 ? 'a inscrição' : `as ${pending.check.signupsToMove} inscrições`}{' '}
                  do e-mail antigo para o novo (recomendado).
                </span>
              </label>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={saving}>
                Voltar
              </Button>
              <Button type="button" onClick={() => save(pending.input, moveSignups)} disabled={saving}>
                {saving ? 'Salvando...' : 'Trocar o e-mail'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Editar cadastro</DialogTitle>
              <DialogDescription>Corrija os dados da conta. O histórico guarda quem alterou e quando.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={(e) => {
                  e.stopPropagation();
                  form.handleSubmit(onSubmit)(e);
                }}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="off" {...field} />
                      </FormControl>
                      <FormDescription>É com ele que a pessoa entra e é a chave das inscrições.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Novo CPF</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" autoComplete="off" placeholder={profile.cpf_masked || 'Sem CPF'} {...field} />
                      </FormControl>
                      <FormDescription>Deixe em branco para manter o atual.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input type="tel" autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="marketingOptIn"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 rounded-md border p-3">
                      <FormLabel className="font-normal">Quer receber novidades por e-mail</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => openDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || checking}>
                    {saving || checking ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
