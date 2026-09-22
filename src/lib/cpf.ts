/** "07123456789" → "071.234.567-89"; empty when it is not an 11-digit CPF. */
export function formatCpf(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return '';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
