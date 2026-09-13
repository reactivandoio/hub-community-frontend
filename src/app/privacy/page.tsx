import type { Metadata } from 'next';
import { Shield } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Hub Community',
  description:
    'Política de Privacidade do Hub Community. Saiba como coletamos, usamos e protegemos seus dados pessoais na nossa plataforma de comunidades de tecnologia.',
};

const sections = [
  {
    id: 'introducao',
    title: '1. Introdução',
    content: `O Hub Community ("nós", "nosso" ou "Plataforma") está comprometido em proteger a privacidade dos seus usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e compartilhamos suas informações pessoais quando você utiliza nossa plataforma.

Ao utilizar o Hub Community, você concorda com as práticas descritas nesta Política. Recomendamos que leia este documento com atenção.`,
  },
  {
    id: 'dados-coletados',
    title: '2. Dados que Coletamos',
    content: `Coletamos diferentes tipos de dados para fornecer e melhorar nossos serviços:

**Dados de Cadastro e Perfil**
• Nome completo
• Endereço de e-mail
• Foto de perfil (opcional)
• Informações profissionais (cargo, empresa, bio)
• Links para redes sociais (GitHub, LinkedIn, etc.)

**Dados de Autenticação**
• Credenciais de login gerenciadas pelo Firebase Authentication
• Tokens de autenticação (armazenados localmente no seu navegador)

**Dados de Uso e Navegação**
• Páginas visitadas e funcionalidades utilizadas
• Eventos visualizados e agendas criadas
• Comentários e interações na plataforma
• Dados de check-in em eventos
• Endereço IP e informações do navegador
• Tipo de dispositivo e sistema operacional

**Dados de Analytics**
• Eventos e métricas coletados pelo Firebase Analytics
• Dados de navegação coletados pelo Google Analytics
• Eventos de rastreamento interno da plataforma (visualização de eventos, talks, agendas, envio de comentários)`,
  },
  {
    id: 'como-usamos',
    title: '3. Como Usamos seus Dados',
    content: `Utilizamos seus dados pessoais para as seguintes finalidades:

**Funcionamento da Plataforma**
• Autenticar sua identidade e gerenciar sua conta
• Personalizar sua experiência na plataforma
• Permitir interações com comunidades e eventos
• Processar check-ins e gestão de presença em eventos

**Melhorias e Analytics**
• Analisar o uso da plataforma para identificar melhorias
• Entender padrões de navegação e engajamento
• Medir a eficácia de funcionalidades
• Gerar relatórios agregados e estatísticas

**Comunicações**
• Enviar notificações relacionadas à sua conta
• Informar sobre eventos e atualizações relevantes
• Comunicar alterações nos nossos Termos ou Políticas`,
  },
  {
    id: 'cookies',
    title: '4. Cookies e Tecnologias de Rastreamento',
    hasLink: true,
    content: `Utilizamos cookies e tecnologias similares para coletar informações sobre sua interação com a Plataforma. As principais tecnologias utilizadas são:

• **Firebase Analytics**: Coleta dados de uso e comportamento dentro da plataforma
• **Google Analytics**: Monitora tráfego, sessões e métricas de engajamento
• **Rastreamento Interno**: Eventos customizados como visualização de eventos, talks, agendas e envio de comentários

Para informações detalhadas sobre os cookies que utilizamos, consulte nossa Política de Cookies.`,
  },
  {
    id: 'compartilhamento',
    title: '5. Compartilhamento de Dados',
    content: `Não vendemos seus dados pessoais a terceiros. Seus dados podem ser compartilhados nas seguintes circunstâncias:

**Provedores de Serviço**
• **Google/Firebase**: Utilizamos serviços do Google (Firebase Authentication, Firebase Analytics, Google Analytics) para autenticação e análise de dados. Os dados são processados de acordo com a Política de Privacidade do Google.
• **Provedores de Infraestrutura**: Servidores e serviços de hospedagem que processam dados em nosso nome.

**Obrigações Legais**
• Quando exigido por lei, ordem judicial ou processo legal
• Para proteger os direitos, propriedade ou segurança do Hub Community, seus usuários ou terceiros

**Dados Públicos**
• Informações de perfil que você optar por tornar públicas (nome, bio, foto, redes sociais) serão visíveis para outros usuários da Plataforma
• Comentários e avaliações publicados são visíveis publicamente`,
  },
  {
    id: 'direitos',
    title: '6. Seus Direitos (LGPD)',
    content: `De acordo com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), você tem os seguintes direitos em relação aos seus dados pessoais:

• **Acesso**: Solicitar acesso aos seus dados pessoais que mantemos
• **Correção**: Solicitar a correção de dados incompletos, inexatos ou desatualizados
• **Exclusão**: Solicitar a exclusão dos seus dados pessoais
• **Portabilidade**: Solicitar a portabilidade dos seus dados para outro serviço
• **Informação**: Ser informado sobre as entidades com as quais seus dados são compartilhados
• **Revogação**: Revogar o consentimento para o tratamento de dados, quando aplicável
• **Oposição**: Opor-se ao tratamento de dados em determinadas situações

Para exercer qualquer um desses direitos, entre em contato conosco pelo e-mail contato@8020digital.com.br. Responderemos à sua solicitação em até 15 dias úteis, conforme previsto na legislação.`,
  },
  {
    id: 'seguranca',
    title: '7. Segurança dos Dados',
    content: `Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais contra acesso não autorizado, destruição, perda, alteração ou divulgação indevida, incluindo:

• Criptografia de dados em trânsito (HTTPS/TLS)
• Autenticação segura via Firebase Authentication
• Controle de acesso baseado em funções
• Monitoramento de atividades suspeitas
• Backups regulares

Apesar das medidas de segurança adotadas, nenhum sistema é completamente seguro. Caso ocorra um incidente de segurança que afete seus dados, notificaremos você e as autoridades competentes conforme exigido pela legislação.`,
  },
  {
    id: 'retencao',
    title: '8. Retenção de Dados',
    content: `Mantemos seus dados pessoais pelo tempo necessário para cumprir as finalidades descritas nesta Política, a menos que um período de retenção mais longo seja exigido ou permitido por lei.

• **Dados de conta**: Mantidos enquanto sua conta estiver ativa. Após exclusão da conta, os dados serão removidos em até 30 dias.
• **Dados de analytics**: Retidos de forma agregada e anonimizada, conforme as políticas de retenção do Firebase Analytics e Google Analytics.
• **Dados de logs**: Mantidos por até 12 meses para fins de segurança e diagnóstico.`,
  },
  {
    id: 'menores',
    title: '9. Menores de Idade',
    content: `O Hub Community não é direcionado a menores de 16 anos. Não coletamos intencionalmente dados pessoais de menores de 16 anos. Se tomarmos conhecimento de que coletamos dados de um menor sem o consentimento adequado, tomaremos medidas para excluir essas informações o mais rápido possível.`,
  },
  {
    id: 'alteracoes',
    title: '10. Alterações nesta Política',
    content: `Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças em nossas práticas, tecnologias ou requisitos legais.

Alterações significativas serão comunicadas através da Plataforma. A data da última atualização será sempre indicada no início deste documento.

Recomendamos que revise esta Política periodicamente para se manter informado sobre como protegemos seus dados.`,
  },
  {
    id: 'contato',
    title: '11. Contato',
    content: `Se você tiver dúvidas, solicitações ou preocupações sobre esta Política de Privacidade ou sobre o tratamento dos seus dados pessoais, entre em contato conosco:

• E-mail: contato@8020digital.com.br
• Plataforma: Hub Community (hubcommunity.com.br)

Para questões relacionadas à LGPD, nosso encarregado de proteção de dados pode ser contactado pelo mesmo e-mail.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto px-4 pt-24 pb-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-secondary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                Política de Privacidade
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
                  {section.id === 'cookies' ? (
                    <>
                      Utilizamos cookies e tecnologias similares para coletar
                      informações sobre sua interação com a Plataforma. As
                      principais tecnologias utilizadas são:
                      {'\n\n'}• <strong>Firebase Analytics</strong>: Coleta dados
                      de uso e comportamento dentro da plataforma{'\n'}•{' '}
                      <strong>Google Analytics</strong>: Monitora tráfego,
                      sessões e métricas de engajamento{'\n'}•{' '}
                      <strong>Rastreamento Interno</strong>: Eventos
                      customizados como visualização de eventos, talks, agendas
                      e envio de comentários
                      {'\n\n'}Para informações detalhadas sobre os cookies que
                      utilizamos, consulte nossa{' '}
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
                href="/terms"
                className="text-primary hover:underline font-medium"
              >
                Termos de Uso
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
