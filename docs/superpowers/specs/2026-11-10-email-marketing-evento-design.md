# REA-29 — E-mail marketing do evento (admin)

Aprovado pelo dono em 2026-11-10 (chat do termhub). Atravessa três repos: `hub-community-backend`
(Strapi), `hub-community-bff` e `hub-community-frontend`.

## Intenção

Dar ao organizador, dentro da página do evento no admin, três e-mails prontos com os dados do evento:

1. **Convite** — para toda a base de usuários do Hub (só `admin` dispara).
2. **Convide alguém** — para os inscritos, com um link pessoal (`?ref=`) e botões de WhatsApp,
   LinkedIn e o link visível para copiar. O inscrito **não** digita e-mail de terceiros (decisão do dono).
3. **Lembrete** — só para os inscritos.

## Regras que não podem quebrar

- **Descadastro (LGPD, legítimo interesse — decisão do dono):** todo e-mail de campanha leva link de
  descadastro e o cabeçalho `List-Unsubscribe` (+ `List-Unsubscribe-Post: One-Click`). Quem está na
  supressão nunca recebe campanha. Os três tipos respeitam a supressão (nossa decisão).
- **Opt-in nos cadastros novos:** checkbox opcional no cadastro (`marketing_opt_in` + data). Fica
  registrado; não restringe o público hoje.
- **Cota diária (Mailgun free = 100/dia, conta compartilhada com os transacionais):** campanhas usam no
  máximo `EMAIL_CAMPAIGN_DAILY_LIMIT` por dia (padrão 70, dia em America/Sao_Paulo), somando todas as
  campanhas. O que sobrar continua no dia seguinte, sozinho, até acabar.
- **Sem e-mail real para a base durante o desenvolvimento:** o processador só roda com
  `EMAIL_CAMPAIGNS_ENABLED=true`; com `EMAIL_CAMPAIGN_REDIRECT_TO` definido, todo envio vai para esse
  endereço (assunto prefixado com o destinatário original). Nada é ligado em produção sem o dono.

## Desenho

### Backend (Strapi)
- `email-suppression` (`email` único, minúsculo; `reason`: `unsubscribe` | `bounce` | `complaint` | `manual`;
  `source`). Sem permissão para nenhum papel; só o token de integração do BFF.
- `email-campaign`: `event_document_id`, `event_slug`, `event_title`, `type`
  (`invite` | `share` | `reminder`), `subject`, `message` (texto opcional), `status`
  (`draft` | `sending` | `paused` | `done` | `canceled`), `total`, `sent`, `failed`, `skipped`,
  `cursor` (último id de usuário processado no convite), `created_by_email`, `started_at`, `finished_at`.
- `email-campaign-delivery`: `campaign` (relação), `email`, `status` (`sending` | `sent` | `failed` |
  `skipped`), `error`, `sent_at`. Índice único (campaign, email) criado no bootstrap — garante um envio
  por pessoa mesmo se o BFF reiniciar no meio.
- Usuário: `marketing_opt_in` (boolean) e `marketing_opt_in_at` (datetime, carimbado por lifecycle quando
  o opt-in vira true; protegido no `user-update-guard`). `register.allowedFields` ganha `marketing_opt_in`.

### BFF
- GraphQL:
  - `eventEmailCampaigns(eventSlug)` → lista com progresso; `emailCampaignAudience(eventSlug, type)` →
    total sem os suprimidos + dias estimados; `emailCampaignPreview(eventSlug, type, subject, message)` → HTML.
  - `sendEmailCampaignTest(...)` → envia uma vez para o e-mail do próprio admin.
  - `startEmailCampaign(...)`, `pauseEmailCampaign(id)`, `resumeEmailCampaign(id)`, `cancelEmailCampaign(id)`.
  - `unsubscribeEmail(token)` (público) → grava a supressão.
  - Autorização: `invite` exige `requireAdmin`; `share`/`reminder` e as leituras, `requireEventOrganizer`.
    Tudo entra na tabela de `authorization.test.js`.
- Público:
  - `invite`: usuários do Strapi não bloqueados, paginados por id (cursor), menos suprimidos e menos quem
    já é inscrito do evento.
  - `share`/`reminder`: inscritos do Eventando com pagamento `CONFIRMED`, sem repetir e-mail, menos suprimidos.
- Processador: `setInterval` de 60 s (padrão do sweep do OpaPingou), só com `EMAIL_CAMPAIGNS_ENABLED`.
  A cada tique: orçamento = limite diário − entregas de hoje; pega a campanha `sending` mais antiga,
  busca o próximo pedaço de destinatários (no máximo 20 por tique), cria a entrega `sending`, envia,
  marca `sent`/`failed`, atualiza contadores e cursor; quando acaba o público, `done`. Uma trava em
  memória impede tiques sobrepostos.
- Token de descadastro: `base64url(email).hmac` com `EMAIL_UNSUBSCRIBE_SECRET`.
- `sendEmail` passa a aceitar `headers`.
- Templates no estilo dos atuais (escapando tudo): nome, data, hora, local, link de inscrição
  (`/events/<slug>?utm_source=email&utm_medium=email&utm_campaign=<tipo>`), mensagem opcional e rodapé
  com o descadastro. O `share` usa `/events/<slug>?ref=<código>` (código = hmac curto do e-mail do
  inscrito + evento) e o link para `/events/<slug>/arte`.

### Front
- Item "E-mail marketing" em `eventNavGroups` (grupo Acompanhamento) → `/admin/events/[id]/email`.
- Página com três cartões (o de convite só aparece para admin): público estimado e dias, assunto e
  mensagem editáveis, prévia (iframe `srcDoc`), "Enviar teste para mim", "Enviar" com confirmação que
  mostra o total. Abaixo, o histórico com progresso, pausar/retomar/cancelar.
- `/descadastro?t=` (página pública): confirma e chama `unsubscribeEmail`.
- `POST /api/email/unsubscribe?t=` (route handler) para o one-click do `List-Unsubscribe`.
- Checkbox de opt-in no cadastro do `AuthModal`.
- `?ref=` na página do evento vai em `metadata.ref` do `trackEvent` (visita e inscrição concluída).

## Fora do escopo
- Relatório de conversão por `ref`, editor visual de e-mail, agendamento para uma data futura,
  webhooks de bounce do Mailgun (a supressão já aceita `bounce`/`complaint` para depois),
  preferências de e-mail no perfil.
