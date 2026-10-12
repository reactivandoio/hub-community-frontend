// Batch prices are stored in cents (Eventando `Batch.value`, the amount sent to the
// payment provider). The admin form works in reais; convert only at the edges.

export function reaisToCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const reais = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(reais) || reais <= 0) return 0;
  return Math.round(reais * 100);
}

export function centsToReais(cents: number | string | null | undefined): number {
  const value = Number(cents);
  if (!Number.isFinite(value)) return 0;
  return value / 100;
}

export function formatCents(cents: number | string | null | undefined): string {
  return centsToReais(cents)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/ /g, ' ');
}
