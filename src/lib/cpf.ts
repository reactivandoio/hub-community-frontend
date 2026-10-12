/** "07123456789" → "071.234.567-89"; empty when it is not an 11-digit CPF. */
export function formatCpf(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return '';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/** Progressive mask for an input: "5299822" → "529.982.2". */
export function maskCpfInput(value: string): string {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function checkDigit(digits: string, len: number): number {
  let sum = 0;
  for (let i = 0; i < len; i += 1) sum += Number(digits[i]) * (len + 1 - i);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/**
 * Client-side check of the signup CPF (the server validates again and has the
 * last word). Never echoes the value back.
 */
export function cpfError(value: string | null | undefined): string | null {
  const d = String(value ?? '').replace(/\D/g, '');
  if (!d) return 'Informe seu CPF.';
  if (
    d.length !== 11 ||
    /^(\d)\1{10}$/.test(d) ||
    checkDigit(d, 9) !== Number(d[9]) ||
    checkDigit(d, 10) !== Number(d[10])
  ) {
    return 'Informe um CPF válido.';
  }
  return null;
}

/** A signup error from the server that belongs under the CPF field. */
export function isCpfMessage(message: string | null | undefined): boolean {
  return /\bCPF\b/i.test(message || '');
}
