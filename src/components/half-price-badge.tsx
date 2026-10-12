import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** REA-16: marks a signup that paid half price, for the check at the door. */
export function HalfPriceBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn('border-amber-500/50 text-amber-700 dark:text-amber-300', className)}>
      Meia-entrada
    </Badge>
  );
}
