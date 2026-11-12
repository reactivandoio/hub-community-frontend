'use client';

import { useMutation, useQuery } from '@apollo/client';
import { AlertTriangle, BadgeCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { approvalReasonLabel, approvalWarningLabel } from '@/lib/manual-approval';
import { signupPaymentView } from '@/lib/paid-signups';
import { APPROVE_SIGNUP_MANUALLY, SIGNUP_APPROVAL_PREVIEW } from '@/lib/queries';
import type { ApproveSignupResult, SignupApprovalPreview } from '@/lib/types';

export interface ApproveSignupTarget {
  signup_id?: string | null;
  name?: string | null;
  email?: string | null;
  product_name?: string | null;
  payment_status?: string | null;
}

interface ApproveSignupButtonProps {
  /** Event slug or id, as the BFF resolves it. */
  event: string;
  signup: ApproveSignupTarget;
  /** After a successful approval: refresh the lists. */
  onApproved: () => void;
}

/**
 * "Aprovar" on a row of the participants list (REA-34): confirms a paid signup without a
 * charge. The preview (vagas, cupom) is fetched when the dialog opens. Admin only: the
 * caller decides when to render it, and the BFF checks the role again.
 */
export function ApproveSignupButton({ event, signup, onApproved }: ApproveSignupButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const signupId = signup.signup_id || '';
  const variables = { event, signupId };

  const { data, loading, error } = useQuery<{ signupApprovalPreview: SignupApprovalPreview }>(
    SIGNUP_APPROVAL_PREVIEW,
    { variables, skip: !open || !signupId, fetchPolicy: 'network-only' },
  );
  const [approve, { loading: approving }] = useMutation<{ approveSignupManually: ApproveSignupResult }>(
    APPROVE_SIGNUP_MANUALLY,
  );

  const preview = data?.signupApprovalPreview;
  const checking = loading || (!preview && !error);
  const canConfirm = !checking && !!preview?.approvable && !approving;

  const handleConfirm = async () => {
    try {
      const { data: result } = await approve({ variables });
      const outcome = result?.approveSignupManually;
      if (!outcome?.success) {
        toast({
          title: 'Não foi possível aprovar',
          description: outcome?.message || 'Tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Inscrição aprovada',
        description: outcome.already_approved
          ? 'Esta inscrição já estava aprovada manualmente.'
          : outcome.email_sent === false
            ? 'Aprovada, mas o e-mail de confirmação não foi enviado.'
            : `${signup.name || signup.email || 'A pessoa'} recebe o e-mail de confirmação com o ingresso.`,
      });
      setOpen(false);
      onApproved();
    } catch (err) {
      toast({
        title: 'Não foi possível aprovar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const facts = [
    { label: 'Nome', value: signup.name },
    { label: 'E-mail', value: signup.email },
    { label: 'Produto', value: signup.product_name },
    { label: 'Status atual', value: signupPaymentView(signup).status },
  ];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        aria-label={`Aprovar inscrição de ${signup.name || signup.email || ''}`.trim()}
        onClick={() => setOpen(true)}
      >
        <BadgeCheck className="h-3.5 w-3.5" />
        Aprovar
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!approving) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar inscrição sem pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Não será gerada cobrança; a pessoa recebe o e-mail de confirmação com o ingresso. A
              inscrição conta como confirmada, com valor pago R$ 0, fora da receita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {facts.map((fact) => (
              <div key={fact.label} className="contents">
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd className="font-medium break-all">{fact.value || '—'}</dd>
              </div>
            ))}
          </dl>

          {checking ? (
            <div role="status" aria-label="Verificando inscrição" className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">
              Não foi possível verificar a inscrição: {error.message}
            </p>
          ) : preview && !preview.approvable ? (
            <p className="text-sm text-destructive">{approvalReasonLabel(preview.reason)}</p>
          ) : preview && preview.warnings.length > 0 ? (
            <ul className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              {preview.warnings.map((warning) => (
                <li key={warning} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{approvalWarningLabel(warning)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={approving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {approving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aprovar inscrição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
