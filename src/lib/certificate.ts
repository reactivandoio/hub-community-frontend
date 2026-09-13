// Pure helpers for participation certificates. No React, no Apollo — safe in Node and browser.

export const PLACEHOLDERS = [
  'nome',
  'evento',
  'carga_horaria',
  'data_inicio',
  'data_fim',
  'local',
  'comunidade',
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

export const DEFAULT_TITLE = 'Certificado de Participação';
export const DEFAULT_PRIMARY_COLOR = '#10B981';
export const DEFAULT_BODY_TEMPLATE =
  'Certificamos que {{nome}} participou do evento {{evento}}, realizado em {{local}} de {{data_inicio}} a {{data_fim}}, com carga horária de {{carga_horaria}} horas.';
export const DEFAULT_BODY_TEMPLATE_NO_LOCATION =
  'Certificamos que {{nome}} participou do evento {{evento}}, de {{data_inicio}} a {{data_fim}}, com carga horária de {{carga_horaria}} horas.';

export interface CertificateEventInfo {
  title: string;
  slug?: string | null;
  start_date: string;
  end_date: string;
  is_online?: boolean | null;
  location?: { title?: string | null; city?: string | null } | null;
  communities?: { title: string }[] | null;
}

export interface CertificateConfigLike {
  title?: string | null;
  body_template?: string | null;
  workload_hours?: number | null;
  issuer_name?: string | null;
  primary_color?: string | null;
  logo?: string | null;
  background?: string | null;
  sponsors?: { name: string; logo?: string | null; url?: string | null }[];
  signatures?: { name: string; role?: string | null; image?: string | null; text?: string | null; font?: string | null }[];
}

export function defaultBodyTemplate(hasLocation: boolean): string {
  return hasLocation ? DEFAULT_BODY_TEMPLATE : DEFAULT_BODY_TEMPLATE_NO_LOCATION;
}

export function resolveTemplate(
  template: string,
  vars: Partial<Record<Placeholder, string>>,
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => {
    const value = (vars as Record<string, string | undefined>)[key];
    return value === undefined ? match : value;
  });
}

export function workloadHours(
  config: { workload_hours?: number | null },
  event: { start_date: string; end_date: string },
): number {
  if (config.workload_hours && config.workload_hours > 0) return config.workload_hours;
  const ms = new Date(event.end_date).getTime() - new Date(event.start_date).getTime();
  const hours = Math.ceil(ms / 3_600_000);
  return Number.isFinite(hours) && hours > 0 ? hours : 1;
}

export function formatHours(hours: number): string {
  return String(hours).replace('.', ',');
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function eventLocationLabel(event: CertificateEventInfo): string {
  if (event.is_online) return 'online';
  const parts = [event.location?.title, event.location?.city].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  return parts.join(', ');
}

export function buildTemplateVars(input: {
  config: CertificateConfigLike;
  event: CertificateEventInfo;
  name: string;
}): Record<Placeholder, string> {
  const { config, event, name } = input;
  return {
    nome: name,
    evento: event.title,
    carga_horaria: formatHours(workloadHours(config, event)),
    data_inicio: formatDate(event.start_date),
    data_fim: formatDate(event.end_date),
    local: eventLocationLabel(event),
    comunidade: (event.communities || []).map((c) => c.title).join(', '),
  };
}

export function resolveBody(
  config: CertificateConfigLike,
  event: CertificateEventInfo,
  name: string,
): string {
  const vars = buildTemplateVars({ config, event, name });
  const template = config.body_template?.trim() || defaultBodyTemplate(Boolean(vars.local));
  return resolveTemplate(template, vars);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function certificateFileName(
  event: { slug?: string | null; title: string },
  name: string,
): string {
  const eventPart = event.slug || slugify(event.title);
  return `certificado-${eventPart}-${slugify(name)}.pdf`;
}

export function normalizeIdentifier(cpf: string): string {
  return (cpf || '').replace(/\D/g, '');
}

export function isValidCpf(cpf: string): boolean {
  const digits = normalizeIdentifier(cpf);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (slice: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += Number(slice[i]) * (factor - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(digits.slice(0, 9), 10) === Number(digits[9]) && check(digits.slice(0, 10), 11) === Number(digits[10]);
}

// Certificates issued without a CPF carry the e-mail as identifier: shown as is.
export function formatCpf(digits: string): string {
  if ((digits || '').includes('@')) return digits;
  const d = normalizeIdentifier(digits);
  if (d.length !== 11) return d;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function imageSrc(
  url: string | null | undefined,
  opts: { server: boolean },
): string | undefined {
  if (!url) return undefined;
  return opts.server ? url : `/api/og-image?url=${encodeURIComponent(url)}`;
}

export function verifyUrl(code: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    (typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://hubcommunity.io');
  return `${base}/certificado/verificar/${code}`;
}
