'use client';

import { useMutation } from '@apollo/client';
import { Loader2, MailWarning, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

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
import { useToast } from '@/hooks/use-toast';
import {
  confirmationEmailFailed,
  resendWait,
  resentNote,
  type ConfirmationEmailLike,
} from '@/lib/confirmation-email';
import { RESEND_SIGNUP_CONFIRMATION } from '@/lib/queries';
import type { ResendSignupConfirmationResult } from '@/lib/types';

interface ResendConfirmationButtonProps {
  /** Event slug or id, as the BFF resolves it. */
  event: string;
  signup: ConfirmationEmailLike & { name?: string | null };
  /** After a resend: refresh the list (it brings the new "Reenviado em"). */
  onResent?: () => void;
}

/**
 * "Reenviar e-mail" on a row of the participants list (REA-50): asks first, then sends the
 * "Inscrição confirmada" e-mail with the ticket again. The caller shows it only on confirmed
 * signups (canResendConfirmation); the BFF checks the role and the status again and allows one
 * resend a minute per signup. A failed first send is flagged next to it.
 */
export function ResendConfirmationButton({ event, signup, onResent }: ResendConfirmationButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  // The last resend known here: the list's, or the one just made (before the refetch lands).
  const [resentAt, setResentAt] = useState<string | null>(signup.confirmation_resent_at ?? null);
  const [wait, setWait] = useState(() => resendWait(signup.confirmation_resent_at));
  const [resend, { loading }] = useMutation<{ resendSignupConfirmation: ResendSignupConfirmationResult }>(
    RESEND_SIGNUP_CONFIRMATION,
  );

  useEffect(() => {
    const fromList = signup.confirmation_resent_at ?? null;
    if (fromList && (!resentAt || new Date(fromList) > new Date(resentAt))) {
      setResentAt(fromList);
      setWait(resendWait(fromList));
    }
    // Only when the list brings a newer date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signup.confirmation_resent_at]);

  // Counts down the wait after a resend.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const who = signup.name || signup.email || 'esta pessoa';
  const failed = confirmationEmailFailed(signup) && !resentAt;
  const note = resentNote(resentAt);

  const handleConfirm = async () => {
    try {
      const { data } = await resend({ variables: { event, signupId: signup.signup_id } });
      const outcome = data?.resendSignupConfirmation;
      if (!outcome?.success) {
        if (outcome?.retry_after) setWait(outcome.retry_after);
        toast({
          title: 'O e-mail não foi reenviado',
          description: outcome?.message || 'Tente novamente.',
          variant: 'destructive',
        });
        setOpen(false);
        return;
      }
      const at = outcome.sent_at || new Date().toISOString();
      setResentAt(at);
      setWait(resendWait(at));
      toast({ title: 'E-mail reenviado', description: outcome.message || `Enviado para ${signup.email}.` });
      setOpen(false);
      onResent?.();
    } catch (err) {
      toast({
        title: 'O e-mail não foi reenviado',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const disabled = loading || wait > 0;

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div className="flex items-center gap-2">
        {failed && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-destructive"
            title={signup.confirmation_email_error || undefined}
          >
            <MailWarning className="h-3.5 w-3.5" />
            Não enviado
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-label={`Reenviar e-mail de confirmação para ${who}`}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {wait > 0 ? `Aguarde ${wait}s` : 'Reenviar e-mail'}
        </Button>
      </div>
      {note && <span className="text-[11px] text-muted-foreground">{note}</span>}

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!loading) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reenviar o e-mail de confirmação?</AlertDialogTitle>
            <AlertDialogDescription>
              {who} recebe de novo o e-mail &quot;Inscrição confirmada&quot;, com o ingresso, em{' '}
              <strong className="text-foreground">{signup.email}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {note && <p className="text-sm text-muted-foreground">{note}.</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reenviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
