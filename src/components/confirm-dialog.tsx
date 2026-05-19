'use client';

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
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  /** Controla se o dialog está aberto */
  open: boolean;
  /** Callback quando o estado de abertura muda */
  onOpenChange: (open: boolean) => void;
  /** Título do dialog */
  title: string;
  /** Descrição/mensagem do dialog */
  description: string;
  /** Texto do botão de confirmar */
  confirmLabel?: string;
  /** Texto do botão de cancelar */
  cancelLabel?: string;
  /** Variante do botão de confirmar */
  variant?: 'default' | 'destructive';
  /** Callback executado ao confirmar */
  onConfirm: () => void | Promise<void>;
  /** Estado de loading do botão de confirmar */
  loading?: boolean;
  /** Desabilita o botão de confirmar */
  disabled?: boolean;
}

/**
 * Componente de diálogo de confirmação reutilizável.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const [deleting, setDeleting] = useState(false);
 *
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Excluir comunidade"
 *   description="Tem certeza que deseja excluir esta comunidade? Esta ação não pode ser desfeita."
 *   confirmLabel="Excluir"
 *   variant="destructive"
 *   loading={deleting}
 *   onConfirm={async () => {
 *     setDeleting(true);
 *     await deleteCommunity();
 *     setDeleting(false);
 *     setOpen(false);
 *   }}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  loading = false,
  disabled = false,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              await handleConfirm();
            }}
            disabled={loading || disabled}
            className={cn(
              variant === 'destructive' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aguarde...
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
