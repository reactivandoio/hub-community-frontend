# REA-29 E-mail marketing do evento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizador dispara convite / "convide alguém" / lembrete do evento, em fila com cota diária e descadastro.

**Architecture:** Strapi guarda campanhas, entregas e supressões (só o token de integração do BFF acessa).
O BFF expõe GraphQL, monta público e HTML, e um processador de 60 s envia respeitando a cota diária.
O front ganha a página `/admin/events/[id]/email`, `/descadastro`, o one-click e o opt-in.

**Tech Stack:** Strapi 5 (TS, yarn, vitest) · BFF Node/Apollo (JS, yarn, vitest) · Next 16 (pnpm, vitest).

**Spec:** `docs/superpowers/specs/2026-11-10-email-marketing-evento-design.md`

## Global Constraints

- Branch `REA-29-email-marketing-evento` nos três repos, a partir da `main` atualizada. Sem merge.
- Nenhum envio real para a base: processador só com `EMAIL_CAMPAIGNS_ENABLED=true`; `EMAIL_CAMPAIGN_REDIRECT_TO` desvia tudo.
- `EMAIL_CAMPAIGN_DAILY_LIMIT` padrão 70; dia em `America/Sao_Paulo`; no máximo 20 envios por tique.
- Token de descadastro: `base64url(email minúsculo) + "." + base64url(hmacSha256(EMAIL_UNSUBSCRIBE_SECRET, email))`.
- Coleções novas não entram em nenhuma lista de `src/roles/definitions.ts`.
- Todo texto vindo do admin ou do evento é escapado no HTML.

## Review Focus

- E-mail com maiúsculas / espaços: supressão e dedupe comparam `trim().toLowerCase()` — teste no Task 2 (token) e Task 4 (público).
- BFF reinicia no meio do envio: entrega `sending` existente não é reenviada — teste no Task 5.
- Cota já gasta pelos transacionais? Não medimos; a folga de 30 cobre. Cota zerada → tique não envia nada — teste no Task 5.
- Token adulterado ou vazio no descadastro → erro amigável, nada gravado — teste no Task 2 e Task 6.
- Community-manager tentando `invite` → FORBIDDEN — linha no `authorization.test.js` (Task 6).

---

### Task 1: Strapi — coleções e opt-in (hub-community-backend)

**Files:** Create `src/api/email-suppression/**`, `src/api/email-campaign/**`, `src/api/email-campaign-delivery/**` (schema + factories, padrão `role-change`); Modify user `schema.json`, `config/plugins.ts` (`allowedFields` + `marketing_opt_in`), `src/roles/user-update-guard.ts` (+`marketing_opt_in_at`), `src/index.ts` (índice único `(campaign_id, email)` na tabela de link/coluna da entrega, padrão dos índices de `votes`; lifecycle que carimba `marketing_opt_in_at`). Helper puro `src/utils/marketing-opt-in.ts`: `stampOptIn(data, now): data`.
- [ ] Teste `stampOptIn` (true sem data → carimba; false → limpa data; ausente → intacto) e o guard bloqueando `marketing_opt_in_at`. `yarn test` passa; `yarn build` passa; `yarn roles:check` sem ações novas. Commit.

### Task 2: BFF — base de e-mail (hub-community-bff)

**Files:** Modify `src/services/email/index.js` (`headers` repassado); Create `src/services/email-campaign/token.js`: `unsubscribeToken(email, env)`, `readUnsubscribeToken(token, env) → email|null` (timingSafeEqual), `shareRef(email, eventSlug, env) → 10 chars base64url`; `src/services/email-campaign/quota.js`: `startOfDaySaoPaulo(now) → Date`, `remainingToday({ sentToday, env }) → number`.
- [ ] Testes: ida e volta do token, maiúsculas normalizadas, token adulterado/vazio → null; quota com limite padrão 70 e env; início do dia às 03:00Z. Commit.

### Task 3: BFF — templates

**Files:** Create `src/services/email/templates/event-campaign.js`: `eventCampaignTemplate({ type, event, message, signupUrl, shareUrl, artUrl, unsubscribeUrl }) → html`; `defaultSubject(type, title)`.
Assuntos: invite `📣 Você está convidado: <título>`; share `🤝 Convide alguém para <título>`; reminder `⏰ Lembrete: <título> está chegando`.
- [ ] Testes: dados do evento presentes, mensagem escapada (`<script>` não aparece), link de descadastro presente, share tem `wa.me`/`linkedin.com/sharing` e o link com `?ref=`. Commit.

### Task 4: BFF — dados e público

**Files:** Create `src/dataSources/manager-integration/email-campaigns/index.js` (CRUD das três coleções; `countDeliveriesSince(date)`; `findDeliveries(campaignId, emails)`; `findSuppressed(emails)`; `addSuppression`), registrar no agregador; `src/services/email-campaign/audience.js`: `nextRecipients({ dataSources, campaign, limit }) → { recipients:[{email,name,cursor?}], exhausted }`, `countAudience({ dataSources, eventSlug, type })`.
- [ ] Testes com data sources falsos: invite pagina por id após `cursor`, pula bloqueados, suprimidos, inscritos do evento e já entregues; share/reminder só `CONFIRMED`, dedupe por e-mail normalizado. Commit.

### Task 5: BFF — processador

**Files:** Create `src/services/email-campaign/sender.js`: `runTick({ dataSources, env, now, send }) → { sent }`, `startEmailCampaignSweep({ env, makeDataSources, intervalMs })`; ligar em `src/index.js` ao lado do sweep do OpaPingou.
- [ ] Testes: flag desligada não envia; cota 0 não envia; entrega existente não reenvia; redirect troca o destinatário e prefixa o assunto; falha marca `failed` e segue; público esgotado → `done`; campanha `paused` ignorada. Commit.

### Task 6: BFF — GraphQL e descadastro

**Files:** Create `src/types/EmailCampaign.graphql`, `src/resolvers/EmailCampaign/index.js` (queries/mutations do spec); entradas no `authorization.test.js`.
- [ ] Testes: invite por community-manager → FORBIDDEN; start cria campanha `sending` com `total`; `unsubscribeEmail` com token inválido → `false` sem gravar; test-send vai para `ctx.user.email`. `yarn test` todo verde. Commit. `.env.example` com as novas variáveis.

### Task 7: Front

**Files:** `src/lib/queries.ts`, `src/lib/types.ts`, `src/lib/admin-nav.ts` (+item, ícone `mail`), `src/app/admin/events/[id]/email/page.tsx`, `src/components/admin/email-campaigns/*`, `src/app/descadastro/page.tsx`, `src/app/api/email/unsubscribe/route.ts`, `src/components/auth-modal.tsx` + `auth.schema.ts` (opt-in), captura de `?ref=` em `src/lib/share-ref.ts` + `trackEvent`.
- [ ] Testes: `admin-nav` tem o item; `share-ref` lê/guarda `ref`; página de descadastro chama a mutation. `pnpm test` e `pnpm build` passam. Commit.
