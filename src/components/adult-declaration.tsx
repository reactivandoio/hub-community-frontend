'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { ADULT_DECLARATION_LABEL } from '@/lib/birth-date';
import { cn } from '@/lib/utils';

interface AdultDeclarationProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Unique per page, so the label targets the right box. */
  id?: string;
  disabled?: boolean;
  /** Shown under the box (e.g. "Confirme que você tem 18 anos ou mais."). */
  error?: string | null;
  /** Different wording when someone else ticks it (staff at the door). */
  label?: string;
  className?: string;
}

/**
 * REA-36: the required "Declaro que tenho 18 anos ou mais" checkbox of every signup form. Never
 * pre-checked; the BFF refuses the form without it and the acceptance is recorded with its date.
 */
export function AdultDeclaration({
  checked, onCheckedChange, id = 'adult-declaration', disabled, error, label = ADULT_DECLARATION_LABEL, className,
}: AdultDeclarationProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex flex-row items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          aria-required="true"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
        />
        <label htmlFor={id} className="text-sm leading-snug text-foreground cursor-pointer">
          {label} <span className="text-destructive" aria-hidden="true">*</span>
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
