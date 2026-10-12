'use client';

import { HelpCircle } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface HalfPriceChoiceProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * REA-16: half price on trust. No document and no list of categories: the person
 * declares it. The "?" is a popover so it opens by tap and by keyboard.
 */
export function HalfPriceChoice({ checked, onCheckedChange, disabled }: HalfPriceChoiceProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <Checkbox
          id="half-price"
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <label htmlFor="half-price" className="text-sm font-medium text-foreground cursor-pointer">
          Quero meia-entrada
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Como funciona a meia-entrada"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="text-sm space-y-2" align="start">
            <p>
              Aqui a meia-entrada é na confiança. Você marca por livre e espontânea vontade, e nós
              confiamos que você se enquadra em algum dos casos previstos na lei.
            </p>
            <p className="text-muted-foreground">Não pedimos documento nem comprovante.</p>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
