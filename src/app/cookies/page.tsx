import type { Metadata } from 'next';
import { Cookie } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Cookies | Hub Community',
  description:
    'Política de Cookies do Hub Community. Saiba quais cookies e tecnologias de rastreamento utilizamos, incluindo Firebase Analytics e Google Analytics.',
};

const cookieTable = [
  {
    category: 'Essenciais',
    cookies: [
      {
        name: 'auth_token',
        type: 'localStorage',
        purpose: 'Token de autenticação JWT para manter sua sessão ativa',
        duration: 'Sessão / até logout',
      },
      {
        name: 'auth_user',
        type: 'localStorage',
        purpose: 'Dados básicos do usuário autenticado (nome, e-mail, avatar)',
        duration: 'Sessão / até logout',
      },
      {
        name: 'theme',
        type: 'localStorage',
        purpose: 'Preferência de tema (claro/escuro) do usuário',
        duration: 'Persistente',
      },
      {
        name: 'hub_cookie_consent',
        type: 'localStorage',
        purpose: 'Registro do consentimento de cookies do usuário',
        duration: 'Persistente',
      },
    ],
  },
  {
    category: 'Analytics — Firebase',
    cookies: [
      {
        name: '_firebase_app_installations',
        type: 'Cookie / IndexedDB',
        purpose:
          'Identificador único da instalação do Firebase para analytics e mensagens',
        duration: 'Persistente',
      },
      {
        name: 'Firebase Analytics Events',
        type: 'IndexedDB',
        purpose:
          'Armazena eventos de analytics antes do envio ao servidor (visualização de eventos, talks, agendas, comentários)',
        duration: 'Temporário (até envio)',
      },
    ],
  },
  {
    category: 'Analytics — Google',
    cookies: [
      {
        name: '_ga',
        type: 'Cookie',
        purpose:
          'Identificador único do Google Analytics usado para distinguir usuários e gerar relatórios de uso',
        duration: '2 anos',
      },
      {
        name: '_gid',
        type: 'Cookie',
        purpose:
          'Identificador do Google Analytics usado para distinguir usuários em sessões de 24 horas',
        duration: '24 horas',
      },
      {
        name: '_gat',
        type: 'Cookie',
        purpose: 'Utilizado para limitar a taxa de requisições ao Google Analytics',
        duration: '1 minuto',
      },
    ],
  },
];

const sections = [
  {
    id: 'o-que-sao',
    title: '1. O que são Cookies',
    content: `Cookies são pequenos arquivos de texto que são armazenados no seu navegador quando você visita um site. Eles são amplamente utilizados para fazer sites funcionarem de forma eficiente e fornecer informações aos proprietários do site.

Além de cookies tradicionais, utilizamos também tecnologias similares como localStorage e IndexedDB para armazenar dados localmente no seu navegador.`,
  },
  {
    id: 'ferramentas',
    title: '3. Ferramentas de Terceiros',
    content: `Utilizamos as seguintes ferramentas de terceiros que podem instalar cookies no seu navegador:`,
  },
  {
    id: 'gerenciar',
    title: '4. Como Gerenciar Cookies',
    content: `Você pode gerenciar cookies através das configurações do seu navegador. A maioria dos navegadores permite:

• Visualizar os cookies armazenados
• Excluir cookies individuais ou todos os cookies
• Bloquear cookies de terceiros
• Bloquear todos os cookies

**Atenção**: Bloquear ou excluir cookies essenciais pode afetar o funcionamento da plataforma, impedindo o login e outras funcionalidades básicas.

Como descrito em nossos Termos de Uso, para utilizar o Hub Community é necessário aceitar todos os cookies. Caso não concorde com o uso dessas tecnologias, a alternativa é não utilizar a plataforma.

Links para gerenciar cookies nos principais navegadores:
• Chrome: chrome://settings/cookies
• Firefox: about:preferences#privacy
• Safari: Preferências > Privacidade
• Edge: edge://settings/privacy`,
  },
  {
    id: 'alteracoes',
    title: '5. Alterações nesta Política',
    content: `Podemos atualizar esta Política de Cookies periodicamente para refletir mudanças nas tecnologias que utilizamos ou em requisitos legais.

Alterações significativas serão comunicadas através da Plataforma. A data da última atualização será sempre indicada no início deste documento.`,
  },
  {
    id: 'contato',
    title: '6. Contato',
    content: `Se você tiver dúvidas sobre esta Política de Cookies, entre em contato conosco:

• E-mail: contato@8020digital.com.br
• Plataforma: Hub Community (hubcommunity.com.br)`,
  },
];

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto px-4 pt-24 pb-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Cookie className="h-5 w-5 text-amber-500" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                Política de Cookies
              </h1>
            </div>
            <p className="text-muted-foreground ml-[52px] max-w-xl leading-relaxed">
              Última atualização: 20 de junho de 2026
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Table of Contents */}
          <nav className="rounded-2xl border border-border/50 bg-card p-6 mb-10">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Índice
            </h2>
            <ul className="space-y-2">
              <li>
                <a
                  href="#o-que-sao"
                  className="text-sm text-primary hover:underline transition-colors"
                >
                  1. O que são Cookies
                </a>
              </li>
              <li>
                <a
                  href="#cookies-utilizados"
                  className="text-sm text-primary hover:underline transition-colors"
                >
                  2. Cookies que Utilizamos
                </a>
              </li>
              {sections.slice(1).map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-primary hover:underline transition-colors"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Section 1: O que são Cookies */}
          <section id="o-que-sao" className="mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4">
              1. O que são Cookies
            </h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {sections[0].content}
            </div>
          </section>

          {/* Section 2: Cookie Table */}
          <section id="cookies-utilizados" className="mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4">
              2. Cookies que Utilizamos
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Abaixo listamos todos os cookies e tecnologias de armazenamento
              local utilizados pelo Hub Community, organizados por categoria:
            </p>

            <div className="space-y-6">
              {cookieTable.map((category) => (
                <div
                  key={category.category}
                  className="rounded-2xl border border-border/50 bg-card overflow-hidden"
                >
                  <div className="px-5 py-3 bg-muted/30 border-b border-border/50">
                    <h3 className="text-sm font-semibold text-foreground">
                      {category.category}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Nome
                          </th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Tipo
                          </th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Finalidade
                          </th>
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Duração
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.cookies.map((cookie) => (
                          <tr
                            key={cookie.name}
                            className="border-b border-border/30 last:border-0"
                          >
                            <td className="px-5 py-3 font-mono text-xs text-foreground whitespace-nowrap">
                              {cookie.name}
                            </td>
                            <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {cookie.type}
                            </td>
                            <td className="px-5 py-3 text-xs text-muted-foreground">
                              {cookie.purpose}
                            </td>
                            <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {cookie.duration}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Third-party tools */}
          <section id="ferramentas" className="mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4">
              3. Ferramentas de Terceiros
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Utilizamos as seguintes ferramentas de terceiros que podem
              instalar cookies no seu navegador:
            </p>
            <div className="space-y-4">
              <div className="rounded-xl border border-border/50 bg-card p-4">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Firebase Analytics
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Serviço do Google utilizado para análise de uso da plataforma.
                  Coleta dados de eventos como visualização de páginas,
                  interações com funcionalidades e métricas de engajamento.
                  Saiba mais na{' '}
                  <a
                    href="https://firebase.google.com/support/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Política de Privacidade do Firebase
                  </a>
                  .
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card p-4">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  Google Analytics
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Serviço de análise web do Google que rastreia e reporta
                  tráfego do site. Coleta dados de forma anônima para gerar
                  relatórios de uso e comportamento. Saiba mais na{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Política de Privacidade do Google
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>

          {/* Remaining sections */}
          {sections.slice(2).map((section) => (
            <section key={section.id} id={section.id} className="mb-10">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {section.title}
              </h2>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </section>
          ))}

          {/* Footer Links */}
          <div className="mt-16 pt-8 border-t border-border/50">
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/terms"
                className="text-primary hover:underline font-medium"
              >
                Termos de Uso
              </Link>
              <Link
                href="/privacy"
                className="text-primary hover:underline font-medium"
              >
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
