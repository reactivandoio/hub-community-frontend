/**
 * REA-65: account deletion (`/excluir-conta`). Pure rules and texts; the page lives in
 * `app/excluir-conta`. What is deleted and what is kept follows the retention table of the app
 * spec (REA-58, §5) — the BFF's `deleteMyAccount` does the work.
 */

export interface MySignupEvent {
  id: string;
  slug?: string | null;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface MySignup {
  id: string;
  product_name?: string | null;
  payment_status?: string | null;
  /** The signup holds its place (paid, free, imported or approved). */
  holds_place: boolean;
  event: MySignupEvent;
}

export interface RetentionItem {
  what: string;
  happens: string;
}

/** What is deleted, in plain words (spec §5). */
export const DELETED_DATA: RetentionItem[] = [
  {
    what: 'Seus dados de cadastro',
    happens:
      'Nome, e-mail, CPF, telefone, data de nascimento, redes sociais e foto de capa deixam de existir na conta, que fica anônima e bloqueada.',
  },
  {
    what: 'Agenda, avaliações e comentários',
    happens: 'Sua agenda pessoal, as avaliações de palestras e os comentários e respostas que você escreveu são apagados.',
  },
  {
    what: 'Acessos e convites',
    happens:
      'Códigos de acesso e convites pendentes são apagados; você deixa de organizar comunidades e de gerir eventos.',
  },
  {
    what: 'Inscrições em eventos',
    happens: 'Nome, e-mail, telefone e CPF das suas inscrições são anonimizados.',
  },
];

/** What is kept, and why (spec §5). */
export const KEPT_DATA: RetentionItem[] = [
  {
    what: 'Pagamentos',
    happens: 'O registro do pagamento das inscrições pagas fica, sem os seus dados, porque é registro fiscal.',
  },
  {
    what: 'Certificados emitidos',
    happens: 'Ficam com o código e o nome, porque quem recebeu o certificado pode precisar comprová-lo pelo código.',
  },
  {
    what: 'Votos',
    happens: 'Ficam, sem ligação com você, para não mudar o resultado de votações.',
  },
  {
    what: 'Perfil de palestrante',
    happens: 'É desligado da sua conta; a programação publicada dos eventos continua de pé.',
  },
  {
    what: 'Descadastro de e-mails',
    happens: 'Guardamos só um código (hash) do seu e-mail para não mandar campanhas para quem saiu.',
  },
];

const timeOf = (value?: string | null) => {
  if (!value) return NaN;
  return new Date(value).getTime();
};

/**
 * The signups whose ticket stops being valid: those holding a place in an event that has not ended
 * yet (the end date, or the start when there is no end), soonest first.
 */
export function signupsLostOnDeletion(signups: MySignup[] | null | undefined, now: Date = new Date()): MySignup[] {
  if (!signups) return [];
  const nowMs = now.getTime();
  return signups
    .filter(signup => {
      if (!signup.holds_place) return false;
      const until = timeOf(signup.event.end_date);
      const when = Number.isNaN(until) ? timeOf(signup.event.start_date) : until;
      return !Number.isNaN(when) && when >= nowMs;
    })
    .sort((a, b) => timeOf(a.event.start_date) - timeOf(b.event.start_date));
}

/** "18 de dezembro de 2026" (São Paulo), or null without a date. */
export function formatEventDate(value?: string | null): string | null {
  const ms = timeOf(value);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(ms));
}
