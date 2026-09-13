import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Uso | Hub Community',
  description:
    'Termos de Uso do Serviço Hub Community. Leia os termos e condições que regem o uso da nossa plataforma de comunidades de tecnologia.',
};

const sections = [
  {
    id: 'aceitacao',
    title: '1. Aceitação dos Termos',
    content: `Ao acessar ou utilizar a plataforma Hub Community ("Plataforma"), você concorda em cumprir e ficar vinculado a estes Termos de Uso do Serviço ("Termos"). Se você não concordar com qualquer parte destes Termos, não deverá utilizar a Plataforma.

A utilização continuada da Plataforma após a publicação de alterações nestes Termos constitui sua aceitação dessas alterações.`,
  },
  {
    id: 'descricao',
    title: '2. Descrição do Serviço',
    content: `O Hub Community é uma plataforma online que conecta desenvolvedores e comunidades de tecnologia, facilitando a descoberta de eventos, meetups, talks e networking entre profissionais de tecnologia.

Nossos serviços incluem, mas não se limitam a:
• Criação e gerenciamento de perfis de comunidades de tecnologia
• Listagem e descoberta de eventos e meetups
• Criação de agendas personalizadas para eventos
• Interação entre membros via comentários e avaliações
• Check-in e gestão de presença em eventos
• Rastreamento de atividades e engajamento na plataforma`,
  },
  {
    id: 'conta',
    title: '3. Conta e Cadastro',
    content: `Para acessar determinadas funcionalidades da Plataforma, você deverá criar uma conta. O processo de autenticação é realizado através do Firebase Authentication.

Ao criar uma conta, você declara que:
• As informações fornecidas são verdadeiras, completas e atualizadas
• Você é responsável por manter a confidencialidade de suas credenciais de acesso
• Você é responsável por todas as atividades realizadas em sua conta
• Você notificará imediatamente o Hub Community sobre qualquer uso não autorizado da sua conta

Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos ou que apresentem atividade suspeita.`,
  },
  {
    id: 'regras',
    title: '4. Regras de Uso da Plataforma',
    content: `Ao utilizar o Hub Community, você concorda em não:
• Utilizar a Plataforma para fins ilegais ou não autorizados
• Publicar conteúdo ofensivo, difamatório, discriminatório ou que viole direitos de terceiros
• Realizar spam, phishing ou qualquer forma de comunicação indesejada
• Tentar acessar áreas restritas da Plataforma sem autorização
• Interferir no funcionamento normal da Plataforma ou de seus servidores
• Coletar dados de outros usuários sem consentimento
• Criar contas falsas ou utilizar identidades fictícias com intuito fraudulento
• Utilizar bots, scrapers ou ferramentas automatizadas sem autorização prévia

O descumprimento dessas regras pode resultar na suspensão ou exclusão da sua conta, sem aviso prévio.`,
  },
  {
    id: 'conteudo',
    title: '5. Conteúdo do Usuário',
    content: `Ao publicar conteúdo na Plataforma (incluindo, mas não se limitando a comentários, avaliações, informações de perfil e dados de comunidades), você:

• Declara ser o titular dos direitos sobre o conteúdo ou possuir autorização para publicá-lo
• Concede ao Hub Community uma licença não exclusiva, global e gratuita para usar, reproduzir, modificar e exibir o conteúdo no âmbito dos serviços da Plataforma
• Reconhece que o conteúdo publicado poderá ser visível para outros usuários da Plataforma

O Hub Community não se responsabiliza pelo conteúdo publicado por usuários, mas reserva-se o direito de remover conteúdo que viole estes Termos ou as leis aplicáveis.`,
  },
  {
    id: 'propriedade',
    title: '6. Propriedade Intelectual',
    content: `Todo o conteúdo original da Plataforma, incluindo mas não se limitando a design, código-fonte, logotipos, textos e gráficos, é de propriedade do Hub Community e está protegido por leis de propriedade intelectual.

O Hub Community é uma plataforma open source, e partes do código-fonte estão disponíveis sob licenças de código aberto específicas em nosso repositório no GitHub. Consulte os arquivos de licença no repositório para informações detalhadas.

Marcas registradas, logotipos e nomes comerciais exibidos na Plataforma são de propriedade de seus respectivos titulares.`,
  },
  {
    id: 'privacidade',
    title: '7. Privacidade e Dados',
    content: `A coleta, uso e proteção de seus dados pessoais são regidos pela nossa Política de Privacidade, que é parte integrante destes Termos. Ao utilizar a Plataforma, você também concorda com os termos da nossa Política de Privacidade.

Utilizamos tecnologias como Firebase Analytics e Google Analytics para rastreamento de uso. Para mais informações, consulte nossa Política de Cookies.`,
  },
  {
    id: 'limitacao',
    title: '8. Limitação de Responsabilidade',
    content: `A Plataforma é fornecida "como está" e "conforme disponível". O Hub Community não garante que:
• A Plataforma estará disponível de forma ininterrupta ou livre de erros
• Os resultados obtidos pelo uso da Plataforma serão precisos ou confiáveis
• Quaisquer defeitos na Plataforma serão corrigidos

Na máxima extensão permitida pela legislação aplicável, o Hub Community não será responsável por danos diretos, indiretos, incidentais, especiais, consequenciais ou punitivos, incluindo perda de dados, lucros cessantes ou interrupção de negócios, decorrentes do uso ou da impossibilidade de uso da Plataforma.

O Hub Community não se responsabiliza por eventos organizados por comunidades na Plataforma, incluindo sua qualidade, segurança ou conformidade com a descrição.`,
  },
  {
    id: 'modificacoes',
    title: '9. Modificações dos Termos',
    content: `O Hub Community reserva-se o direito de modificar estes Termos a qualquer momento. Alterações significativas serão comunicadas através da Plataforma ou por e-mail.

A data da última atualização será sempre indicada no início deste documento. O uso continuado da Plataforma após as alterações constitui aceitação dos novos Termos.`,
  },
  {
    id: 'legislacao',
    title: '10. Legislação Aplicável',
    content: `Estes Termos são regidos pelas leis da República Federativa do Brasil. Quaisquer disputas decorrentes destes Termos serão submetidas ao foro da comarca de Goiânia, Estado de Goiás, com exclusão de qualquer outro, por mais privilegiado que seja.`,
  },
  {
    id: 'contato',
    title: '11. Contato',
    content: `Se você tiver dúvidas sobre estes Termos de Uso, entre em contato conosco:

• E-mail: contato@8020digital.com.br
• Plataforma: Hub Community (hubcommunity.com.br)`,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto px-4 pt-24 pb-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                Termos de Uso do Serviço
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
              {sections.map((section) => (
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

          {/* Sections */}
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.id} id={section.id}>
                <h2 className="text-xl font-bold text-foreground mb-4">
                  {section.title}
                </h2>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {section.id === 'privacidade' ? (
                    <>
                      A coleta, uso e proteção de seus dados pessoais são
                      regidos pela nossa{' '}
                      <Link
                        href="/privacy"
                        className="text-primary hover:underline font-medium"
                      >
                        Política de Privacidade
                      </Link>
                      , que é parte integrante destes Termos. Ao utilizar a
                      Plataforma, você também concorda com os termos da nossa
                      Política de Privacidade.
                      {'\n\n'}
                      Utilizamos tecnologias como Firebase Analytics e Google
                      Analytics para rastreamento de uso. Para mais informações,
                      consulte nossa{' '}
                      <Link
                        href="/cookies"
                        className="text-primary hover:underline font-medium"
                      >
                        Política de Cookies
                      </Link>
                      .
                    </>
                  ) : (
                    section.content
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* Footer Links */}
          <div className="mt-16 pt-8 border-t border-border/50">
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/privacy"
                className="text-primary hover:underline font-medium"
              >
                Política de Privacidade
              </Link>
              <Link
                href="/cookies"
                className="text-primary hover:underline font-medium"
              >
                Política de Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
