# REA-6 — Inscrição paga com o Opa Pingou (Pix): desenho

Data: 2026-10-10. Status: frontend implementado neste PR; Eventando Manager, BFF e cupom
especificados abaixo e ainda por implementar. Plano: `docs/superpowers/plans/2026-10-10-rea-6-pagamento-opa-pingou.md`.

> Correção do primeiro levantamento: a conclusão "o Opa Pingou não tem API de comerciante" veio
> de um checkout local parado em `973e2d2`. A `origin/main` (tag de produção `v1.1.0`, a0a1e60)
> já tem API REST com chave, idempotência e webhooks assinados. Lição registrada no termhub.

## 0. Contrato do Pedro e decisões (2026-10-10) — prevalece sobre o resto deste spec

O contrato do Opa Pingou escrito pelo Pedro é a referência; onde as seções abaixo (levantadas do
código do Opa Pingou por outro agente) divergirem, vale esta seção, e vale a API real se ela
divergir do contrato.

**API.** Produção `https://api.opapingou.com.br`, staging `https://api-stg.opapingou.com.br` (o
staging fala com bancos reais: cobrança paga lá é dinheiro de verdade). `Authorization: Bearer
opk_live_…|opk_test_…`; a chave define a empresa e as contas que recebem. Erros
`application/problem+json`: tratar pelo `code`, registrar o `requestId`, nunca o texto. Limite: 300
req/min por chave e 60/min para criar cobrança; 429 → espera com recuo crescente e repete. Rotas
usadas: `GET /v1/health`, `GET /v1/me` (`profile:read`), `POST /v1/charges` (`charges:write`),
`GET /v1/charges/{id}` (`charges:read`); para o cadastro do webhook, `POST /v1/webhook-endpoints`
(`webhooks:write`). Não existe REST de pagamentos nem de contas bancárias.

**Cobrança.** Corpo estrito `{ amountCents (int > 0), validity, description? (≤140), kind? }`;
**sem `bankAccountId`** (o Opa Pingou escolhe a conta). Validade **`FIFTEEN_MIN`** para o Pix e para
a reserva da vaga. Meios: **Pix (`PIX_QR`) e link de pagamento (`PAYMENT_LINK`)** — o participante
escolhe; o link é o checkout do Mercado Pago e exige conta Mercado Pago conectada na empresa (sem
ela a API devolve `PAYMENT_LINK_UNAVAILABLE`, e a opção some com aviso). `brCode` e `paymentLink`
podem vir nulos. Guardar em cada cobrança: `id`, `txid`, `Idempotency-Key`, `status`, `expiresAt`.

**Idempotência.** `Idempotency-Key = signup-payment-<paymentId>-v<n>`, gravada **antes** da
chamada; timeout ou erro de rede repete com a mesma chave (`Idempotent-Replayed: true`); 409
`IDEMPOTENCY_KEY_REUSED` e 400 `IDEMPOTENCY_KEY_REQUIRED` são erro nosso: não repete, registra e
alerta. Chave vale 24 h. Cobrança vencida nunca é reaproveitada: nova tentativa, nova chave. Trocar
de Pix para link (ou o contrário) também é nova tentativa.

**Webhook.** Rota pública `POST https://bff.hubcommunity.io/webhooks/opapingou`. Assinatura
`Opa-Signature: t=<s>,v1=<hex>` = HMAC-SHA256(`whsec_`, `"<t>.<corpo bruto>"`) em hex minúsculo,
comparação em tempo constante, recusa se |agora − t| > 300 s. Tratados: `charge.paid`,
`charge.expired`, `charge.canceled`, `payment.confirmed`, `payment.refunded`,
`payment.charged_back`; `ping` → 200; demais (`bank_account.*`, `recurrence.*`,
`recurring_charge.*`) → 200 ignorado. **Responde 2xx rápido e processa depois**: o evento é gravado
por `Opa-Event-Id` (repetido é ignorado) e processado fora da requisição; o Opa Pingou reenvia por
até 24 h, então eventos chegam repetidos e fora de ordem. `testMode: true` é ignorado em produção.
`charge.paid` e `payment.confirmed` **nunca liberam pelo corpo**: reconsulta `GET /v1/charges/{id}` e
usa o `status` devolvido; o objeto `payment` não é documentado, então `payment.confirmed` só
reconsulta se trouxer o id da cobrança — senão fica registrado e a confirmação vem pelo
`charge.paid`. `payment.refunded` e `payment.charged_back`: só registra e alerta.

**Reembolso.** Só manual, pelo suporte no WhatsApp. Texto e número configuráveis
(`REFUND_SUPPORT_TEXT`, `REFUND_SUPPORT_WHATSAPP`); número ainda não informado — sem número
configurado, a tela não mostra o contato.

**Flag.** `OPAPINGOU_ENABLED`, desligada por padrão, no Eventando e no BFF; com ela desligada nada
muda (PixAI segue como hoje) e a rota de webhook responde 404.

**Segredos.** Só em variável de ambiente e em secret do GitHub; nunca em código, log, mensagem de
erro, PR ou spec. Secrets: `OPAPINGOU_API_KEY` em `reactivandoio/eventando-manager` e
`OPAPINGOU_WEBHOOK_SECRET` em `reactivandoio/hub-community-bff`, gravados por
`scripts/opapingou-secrets.sh` (entrada oculta, stdin para o `gh`). Hoje nenhum deploy lê secret do
GitHub: o Eventando é atualizado à mão (`make update` + pm2, `.env` no servidor) e o workflow do BFF
só faz SSH + `make update`. O plano acrescenta um passo que leva os secrets ao `.env` do servidor
via SSH por stdin.

**Testes.** Automatizados com a API simulada: criação, repetição idempotente, 409, 401, 429,
assinatura válida, inválida, timestamp vencido, evento duplicado, fora de ordem. Roteiro manual em
produção/staging com R$ 1,00 — só com ok explícito do Pedro (dinheiro real).

## 1. Contrato levantado do código do Opa Pingou (origin/main = v1.1.0; a §0 prevalece)

Fonte: `opapingou/monorepo` em `origin/main` — `apps/api/src/rest/v1/*`,
`apps/api/src/outbound-webhooks/*`, `packages/core/src/api/*`, docs em
`apps/web/src/content/api-docs*.ts` (página `/docs`). O mesmo contrato que o docverse usa
(o repositório do docverse fica no jarvis e não está acessível desta máquina).

- **Base:** `https://api.opapingou.com.br` (marcada "provisória" na doc), rotas em `/v1`.
- **Chave:** `Authorization: Bearer opk_live_…` | `opk_test_…` (criada em `/app/chaves` ou no app,
  mostrada uma vez). Escopos usados: `charges:write`, `charges:read` (+ `webhooks:write` se o
  endpoint for registrado pela API). Chave `opk_test_` só enxerga contas `testMode` (sandbox do
  provedor) e só recebe webhooks delas — é o ambiente de teste.
- **Criar cobrança:** `POST /v1/charges`, header `Idempotency-Key` obrigatório (24 h por chave;
  mesmo corpo → mesma cobrança com `Idempotent-Replayed: true`; corpo diferente → 409).
  Corpo estrito: `{ amountCents, validity: FIFTEEN_MIN|ONE_HOUR|ONE_DAY|SEVEN_DAYS,
  description? (≤140), kind?: PIX_QR|PAYMENT_LINK, bankAccountId? }`.
  Resposta 201 `ChargeResource { id, status: PENDING|PAID|EXPIRED|CANCELED, amountCents,
  brCode (Pix copia-e-cola), paymentLink, expiresAt, paidAt, bankAccount{…testMode}, … }`.
  Não há referência externa/metadata nem dados do pagador: o vínculo é o `id` da cobrança, que
  o Hub guarda.
- **Consultar:** `GET /v1/charges/{id}` → mesmo `ChargeResource`.
- **Webhook de saída:** registrado por empresa (`POST /v1/webhook-endpoints` ou tela
  `/app/webhooks`), só https público. Eventos usados: `charge.paid`, `charge.expired`,
  `charge.canceled` (+ `ping`). Corpo `{ id, type, occurredAt, testMode, data: { type: 'charge',
  object: ChargeResource } }`. Headers `Opa-Event-Id` (= `id`), `Opa-Event-Type`,
  `Opa-Signature: t=<unix s>,v1=<hex HMAC-SHA256(secret, "<t>.<corpo cru>")>` (pode trazer
  vários `v1`), tolerância 300 s, segredo `whsec_…` mostrado uma vez. Sucesso = 2xx em 10 s;
  8 tentativas em ~45 h; reenvio manual em `/v1/webhook-deliveries/{id}/redeliver`.
- **Não existe por REST:** cancelar, estornar, simular pagamento. Simulação só pela mutation
  GraphQL `simulateChargePayment` (JWT de usuário) ou pelo sandbox do provedor.
- **Conta que recebe:** roteamento automático entre as contas da empresa no escopo da chave;
  `bankAccountId` fixa a conta. Recomendação: chave restrita a uma conta.

## 2. Onde a inscrição paga vive hoje

Eventando Manager (Strapi 4, `reactivando/eventando-manager`): Event → Product → Batch
(`value` em centavos) e Signup 1:1 Payment (`status` `PEDING_PAYMENT|CANCELED|CONFIRMED|REFUND`).
`POST /api/signup/:eventId` (`signup.customCreate`) valida lote/estoque/vagas/cupom, cria a
cobrança no PixAI e o Payment pendente. O BFF chama isso em `signupToEvent`.

## 3. Desenho

```
Participante → Front (/events/[id]/signup) → BFF signupToEvent → Eventando customCreate
                                                         └─ POST /v1/charges (opk_… só no Eventando)
Opa Pingou ──webhook──▶ BFF POST /webhooks/opapingou (verifica Opa-Signature, corpo cru)
                         └─▶ Eventando POST /api/payment/opapingou/sync {charge_id}
                               └─ GET /v1/charges/{id} (fonte da verdade) → transição atômica
                         └─ se transicionou para CONFIRMED: e-mail "Inscrição confirmada" com ingresso
Front (passo Pix) ── polling 4 s ──▶ BFF signupPaymentStatus(signupId)
```

Por que o webhook entra pelo BFF e a cobrança nasce no Eventando: o Eventando tem o modelo e
a contagem de vagas; o BFF tem Express (rotas REST já existem, ex. `/upload`) e o e-mail de
confirmação do Hub (`sendSignupConfirmation`, com QR do ingresso). O Eventando reconsulta a
cobrança antes de confirmar, então nem um webhook forjado que passasse a assinatura confirmaria
algo que o Opa Pingou não marcou como `PAID`.

### 3.1 Eventando Manager

> Atualizado pela §0: validade `FIFTEEN_MIN`, sem `bankAccountId`, `kind` escolhido pelo
> participante (`PIX_QR` ou `PAYMENT_LINK`), `Idempotency-Key` gravada antes da chamada, flag
> `OPAPINGOU_ENABLED`. O plano detalha.

Schema:
- `Event.payment_provider`: enum `pixai|opapingou`, default `pixai` (eventos atuais não mudam).
- `Payment`: `status` ganha `EXPIRED`; novos `provider` (string), `provider_charge_id` (string),
  `pix_br_code` (text), `expires_at` (datetime), `expired_at` (datetime).

`src/datasources/opapingou/index.js` (axios, env abaixo): `createCharge({ amountCents,
description, idempotencyKey })` → `POST /v1/charges` com `validity = OPAPINGOU_CHARGE_VALIDITY`
(default `ONE_HOUR`), `kind: 'PIX_QR'`, `bankAccountId = OPAPINGOU_BANK_ACCOUNT_ID` se houver;
`getCharge(id)`. Erros `problem+json` viram mensagem amigável.

`signup.customCreate`, quando `event.payment_provider === 'opapingou'` e valor > 0:
1. Antes de contar estoque/vagas: marca como `EXPIRED` (+`expired_at`) os `PEDING_PAYMENT` com
   `provider='opapingou'` e `expires_at < agora` — a vaga volta (a contagem já usa só
   `CONFIRMED|PEDING_PAYMENT`).
2. Inscrição duplicada: se a inscrição existente tem pagamento `PEDING_PAYMENT` ainda válido,
   devolve o mesmo pagamento (a pessoa reabre o Pix); se `EXPIRED|CANCELED`, cria um novo
   pagamento e religa a mesma inscrição; se `CONFIRMED`, mantém "Você já está inscrito".
3. `payment_identification = randomUUID()`; `createCharge` com `Idempotency-Key =
   payment_identification`; `description = "Inscrição <evento> - <nome>"` (cortada em 140).
4. Payment `{ provider:'opapingou', provider_charge_id, pix_br_code: brCode, payment_link,
   expires_at, status:'PEDING_PAYMENT' }`.
5. Resposta acrescenta `payment_provider`, `pix_br_code`, `expires_at`, `value` (centavos).

`POST /api/payment/opapingou/sync` (auth padrão = token de integração do BFF), corpo
`{ charge_id }`: grava o recebido em `PaymentIntegration`, acha o Payment por
`provider_charge_id` (404 se não for nosso), faz `getCharge`, mapeia
`PAID→CONFIRMED`, `EXPIRED→EXPIRED`, `CANCELED→CANCELED`, `PENDING→(nada)` e aplica com
`updateMany({ where: { id, status: { $in: origens } } })`:
- `CONFIRMED` a partir de `PEDING_PAYMENT|EXPIRED|CANCELED` (Pix pago depois de expirar é
  honrado: o dinheiro entrou; pode passar 1 da lotação — o admin vê no card de pagamentos);
- `EXPIRED|CANCELED` só a partir de `PEDING_PAYMENT`.
Responde `{ transitioned: count === 1, status, payment: { id, value, signup: { id, name, email,
phone_number }, event: { id, uuid, slug } } }`. A idempotência vem daí: webhook repetido ou
reenviado encontra o status já aplicado e devolve `transitioned: false`.

Testes: módulos puros (mapeamento de status, regras de transição, montagem do corpo da
cobrança) com `node --test` (o repositório não tem runner; sem dependência nova).

### 3.2 BFF

> Atualizado pela §0: o webhook responde 2xx depois de gravar o evento (por `Opa-Event-Id`) e
> processa fora da requisição; a lista de eventos tratados é a da §0. O plano detalha.

- `src/services/opapingou/signature.js`: `verifyOpaSignature(rawBody, header, secret, nowS)` —
  parse `t=…,v1=…` (vários `v1`), |agora − t| ≤ 300, `timingSafeEqual` do hex.
- `src/services/opapingou/webhook.js` `handleOpaWebhook({ rawBody, headers, secret,
  dataSources, sendConfirmation })` → `{ status, body }`:
  assinatura inválida/ausente → 401 (nada é tocado); `ping` ou tipo fora de
  `charge.paid|charge.expired|charge.canceled` → 200 ignorado; senão `sync(charge_id)`;
  404 do Eventando (cobrança que não é de inscrição) → 200 ignorado; erro do Eventando → 500
  (o Opa Pingou reenvia); `transitioned && status === 'CONFIRMED'` → `sendSignupConfirmation`
  com ingresso (novo parâmetro `isPaid`: `hasTicket = !online && (isFree || isPaid)`).
- `src/index.js`: `app.post('/webhooks/opapingou', express.raw({ type: '*/*', limit: '1mb' }),
  …)` registrado **antes** do `bodyParser.json()` do Apollo.
- `signupToEvent`: se `payment.payment_provider === 'opapingou'` e não é grátis, **não** manda o
  e-mail de confirmação na hora (vai no webhook). PixAI segue como hoje.
- GraphQL (o frontend deste PR já usa):
  ```graphql
  type SignupPaymentStatus { signup_id: ID! status: String! provider: String expires_at: String
    confirmed_at: String pix_br_code: String payment_link: String value: Float }
  type EventPaymentSettings { payment_provider: String }
  type EventPayment { email: String! name: String status: String! value: Float expires_at: String }
  extend type Query {
    signupPaymentStatus(signupId: ID!): SignupPaymentStatus      # público (só status/Pix)
    eventPaymentSettings(eventId: ID!): EventPaymentSettings      # admin
    eventPayments(slugOrId: String!): [EventPayment!]!            # admin
  }
  # EventSaleInput ganha: payment_provider: String  (updateEventSale grava no Event do Eventando)
  ```
- `eventSignups` (check-in, crachá, sorteio) e `isUserSignedUp`: inscrição paga só conta com
  pagamento `CONFIRMED` — pendente/expirado não é inscrito.
- Testes Vitest: assinatura (válida, adulterada, fora da janela, vários v1), handler (401,
  ping, repetido sem e-mail duplicado, 404 ignorado, 500 propaga), resolvers novos.

### 3.3 Frontend (este PR)

- **Preço em reais no admin, centavos no armazenamento** (`src/lib/money.ts`): corrige o bug em
  que o admin digitava 50 (reais) e o lote era gravado/cobrado como R$ 0,50.
- Seletor "Pagamento dos lotes pagos" (Opa Pingou / Pix Aí) na aba Produtos & Lotes; carregado
  por `eventPaymentSettings` e salvo via `updateEventSale` — fora de `updateEvent` e da query
  pública, para o site não quebrar se o frontend subir antes do BFF.
- Passo de pagamento do Opa Pingou (`SignupPixPayment`): QR gerado do `brCode`, copia-e-cola,
  valor, prazo, polling de 4 s; pago → tela de inscrição confirmada (com ingresso); expirado ou
  cancelado → "a vaga foi liberada" + "Tentar novamente". O passo do PixAI não mudou.
- A decisão grátis/pago usa o `is_free` do servidor (cupom/meia podem zerar o valor).
- Analytics do evento: card "Pagamentos" (pagos, pendentes, expirados, cancelados, total
  recebido) via `eventPayments`; não aparece em evento gratuito nem se a query falhar.

### 3.4 Cupom de desconto (regras do Pedro, 2026-10-10)

Reaproveita o `api::coupon` do Eventando, o `validateCoupon` e o CRUD do BFF e o campo de cupom
da inscrição no frontend. As regras abaixo são do Pedro.

**Regras** (todas confirmadas pelo Pedro, exceto o CPF)
- Um cupom vale para **um único evento**. O código é **único por evento**, não no sistema todo
  (hoje é `unique` global; a unicidade passa a ser `(event, code)`, conferida no servidor dentro
  da mesma transação, porque o Strapi 4 não declara índice composto no schema).
- Tipo **percentual** (1–100) ou **valor fixo** (centavos). Tipo e valor **travam depois do
  primeiro uso** (o admin ainda pode desativar, mudar datas e limite).
- **Validade:** `starts_at` e `expires_at`; vazio = vale pelo período do lote (`valid_from` /
  `valid_until`).
- **Limite total** `max_uses` (vazio = ilimitado) e **um cupom por evento por CPF**: cada CPF usa
  no máximo um cupom qualquer naquele evento.
- **Meia-entrada não soma com cupom:** aplica o **maior** dos dois descontos, nunca os dois. Empate:
  vale a meia e o cupom não é consumido. A pessoa vê qual desconto foi aplicado e por quê.
- **Arredondamento:** o **valor final** arredonda para baixo (centavo inteiro):
  `final = floor(base × (100 − pct) / 100)`; fixo: `final = max(0, base − fixo)`.
- **Valor final zero:** inscrição sem cobrança, `CONFIRMED` na hora, e-mail com ingresso, uso conta.
- **Valor final abaixo do mínimo de cobrança** (e maior que zero): sobe para o mínimo, com aviso
  na tela ("valor mínimo de cobrança: R$ x"). Mínimo configurável por provedor
  (`OPAPINGOU_MIN_CHARGE_CENTS`, `PIXAI_MIN_CHARGE_CENTS`, ambos 1 por padrão). Opa Pingou: o código
  (`packages/core`, `MIN_CHARGE_CENTS = 1`, máximo R$ 25.000,00) aceita 1 centavo. Pix Aí: sem
  mínimo (conferido pelo Pedro). A regra do aviso fica para o caso de um mínimo aparecer.
- **Pix pago depois de vencer** com o cupom já esgotado: honra (pode passar 1 do limite).
- Só **admin** cria, edita e apaga cupons (`requireAdmin` do PR #33 do BFF; o PR de cupom do BFF
  vai empilhado nele ou depois do merge).

**Onde se calcula:** só no Eventando, em `src/utils/pricing.js` (puro, inteiros):
`{ originalCents, discountKind: 'coupon'|'student'|null, discountCents, minApplied, finalCents }`.
`customCreate` e a rota nova `POST /api/coupon/preview` usam o mesmo módulo; o `validateCoupon` do
BFF chama o preview; o navegador só exibe. `amountCents` enviado ao Opa Pingou = `finalCents`.

**CPF:** decidido pelo Pedro: a inscrição guarda o CPF (§3.5); a regra "um cupom por evento
por CPF" usa esse campo.

**Sem corrida e sem consumo por Pix vencido:** dentro de `strapi.db.transaction`, `SELECT … FOR
UPDATE` nas linhas do cupom, do lote e do evento; expira os pendentes vencidos; conta só
`CONFIRMED` e `PEDING_PAYMENT` dentro do prazo (limite total e CPF); grava o Payment pendente com a
`Idempotency-Key`; solta a trava; só então chama o Opa Pingou. Falha definitiva → `CANCELED`, o
uso e a vaga voltam. A mesma trava cobre a contagem de vagas do lote e do evento.

**Modelo:** Coupon ganha `discount_type`, `discount_value_cents`, `starts_at`, `batches`
(manyToMany, vazio = todos); `code` deixa de ser único global. Payment ganha `discount_kind`,
`discount_cents`, `min_charge_applied`; o CPF fica em `Signup.cpf` (§3.5).

**Frontend:** aba "Cupons" no admin do evento (lista com usos/limite; criar e editar com valor fixo
em reais → centavos; tipo e valor bloqueados após o primeiro uso); na inscrição, campo CPF (§3.5),
cupom, preço final, desconto aplicado e aviso de mínimo vindos do servidor.

### 3.5 CPF na inscrição (decisões do Pedro, 2026-10-10)

O Eventando passa a guardar o CPF em **toda inscrição**, gratuita ou paga, com ou sem cupom, em
**texto puro** (só dígitos; o Pedro dispensou cifrar). Contexto: o Eventando vai fazer parte do Hub
Community e os termos de uso serão atualizados.

- **Campo:** `Signup.cpf`, string de 11 dígitos, `private: true` no schema do Strapi — os
  controladores padrão (`/api/signups`) nunca o devolvem, nem com token. Não é `required` no
  schema, para não travar a edição das inscrições antigas no admin; a obrigatoriedade fica nas
  rotas que criam inscrição.
- **Obrigatório em toda inscrição nova:** `POST /api/signup/:id` (`customCreate`, gratuita ou
  paga, PixAI ou Opa Pingou) recusa sem CPF válido; a inscrição manual na porta do BFF
  (`manualSignup`, REA-4) passa o CPF que já coleta.
- **Validação no servidor** (`src/utils/cpf.js`, puro): tira máscara, exige 11 dígitos, recusa
  sequências repetidas e confere os dois dígitos verificadores. Erro → 400 com mensagem amigável,
  sem ecoar o valor. O navegador só aplica máscara.
- **Inscrições já existentes sem CPF:** continuam válidas (check-in, crachá, certificado e
  sorteio não mudam) com `cpf` nulo. Recomendação: preencher por um script de uma vez,
  `scripts/backfill-signup-cpf`, que copia o CPF da conta do Hub ou do `sw-form` com o mesmo e-mail
  (a mesma regra do `withCpf` do BFF), só onde o `cpf` está vazio e o CPF é válido; roda primeiro
  em modo de simulação (só contagens, sem CPF na saída) e grava só com ok do Pedro. O que sobrar
  sem CPF fica nulo. Inscrição antiga sem CPF não conta para a regra do cupom.
- **Regra do cupom:** dentro da transação do §3.4, conta `Payment` com `coupon` não nulo, do mesmo
  evento, cuja inscrição tem o mesmo `cpf`, em `CONFIRMED` ou `PEDING_PAYMENT` no prazo. Achou →
  "Você já usou um cupom neste evento." Pix vencido ou cancelado não conta.
- **Cuidados:**
  - Leitura só por quem tem permissão: nenhuma rota pública devolve o CPF; o BFF não recebe o CPF
    do Eventando nesta entrega (a regra do cupom roda no Eventando). Se o admin precisar ver, será
    por rota própria com `requireAdmin` (PR #33), mascarado (`***.456.789-**`).
  - Nunca em log, mensagem de erro, payload de webhook, e-mail ou analytics; a resposta de
    `customCreate` (que hoje devolve `...signupEntry`) passa a remover o `cpf`.
  - As rotas sem autenticação do Eventando que devolvem inscrição populada
    (`POST /api/payment/integration`, `/api/payment/email`, `/api/payment/resend-email`) passam a
    exigir token de integração neste trabalho, porque devolveriam o CPF. O datasource do PixAI hoje
    registra `{ err, config }` no `console.log` (inclui o token do PixAI e nome/e-mail na
    descrição): passa a registrar só método, rota, status e `requestId`.
  - Depende do PR #33 (Fase 1 LGPD) para as rotas de admin; base legal e aviso de coleta entram nos
    termos de uso que o Pedro vai atualizar.

## 4. Estados e a vaga

| Estado | Participante vê | Vaga | Admin vê |
|---|---|---|---|
| `PEDING_PAYMENT` | Pix + prazo | reservada até `expires_at` | Pagamento pendente |
| `CONFIRMED` | Inscrição confirmada + e-mail com ingresso | ocupada | Pago |
| `EXPIRED` | "O prazo do Pix acabou" + tentar de novo | liberada | Expirado |
| `CANCELED` | "Pagamento cancelado" + tentar de novo | liberada | Cancelado |
| `REFUND` | — | liberada | Reembolsado |

**Reembolso:** o Opa Pingou não tem estorno por API (só registra `payment.refunded` quando o
provedor avisa). Proposta: reembolso manual pelo banco/provedor e o admin marca o Payment como
`REFUND` no Eventando; quando o Opa Pingou expuser estorno, ouvir `payment.refunded`. Pendência.

## 5. Configuração

Eventando Manager (`.env` do servidor; a chave vem do secret `OPAPINGOU_API_KEY`):
- `OPAPINGOU_ENABLED=false` (liga só depois do roteiro manual)
- `OPAPINGOU_API_URL=https://api.opapingou.com.br` (staging: `https://api-stg.opapingou.com.br`)
- `OPAPINGOU_API_KEY=opk_…`
- `OPAPINGOU_CHARGE_VALIDITY=FIFTEEN_MIN`
- `OPAPINGOU_MIN_CHARGE_CENTS=1`, `PIXAI_MIN_CHARGE_CENTS=1` (nenhum mínimo conhecido além de
  1 centavo; se aparecer, sobe o valor e mostra o aviso)
- `REFUND_SUPPORT_TEXT`, `REFUND_SUPPORT_WHATSAPP` (número a informar)

BFF (`.env` do servidor; o segredo vem do secret `OPAPINGOU_WEBHOOK_SECRET`):
- `OPAPINGOU_ENABLED=false`
- `OPAPINGOU_WEBHOOK_SECRET=whsec_…`
- `OPAPINGOU_ACCEPT_TEST_MODE=false` em produção

Opa Pingou: endpoint `https://bff.hubcommunity.io/webhooks/opapingou`, eventos `charge.paid`,
`charge.expired`, `charge.canceled`, `payment.confirmed`, `payment.refunded`,
`payment.charged_back`. Até o deploy do BFF essa rota não existe (o Apollo, montado em `/`,
responde 400 a qualquer POST): o Opa Pingou recebe erro e reenvia; sem sucesso por ~45 h ele
desativa o endpoint (`disabledReason: auto`) e é preciso reativá-lo (`PATCH status: ACTIVE`).

Ordem de deploy: Eventando (schema) → BFF → frontend; a flag só liga depois do roteiro manual.

## 6. Pendências

Resolvidas pelo Pedro (2026-10-10): ambiente (o do contrato), nome dos secrets (definidos acima),
conta que recebe (automática, sem `bankAccountId`), validade `FIFTEEN_MIN`, Pix e link, reembolso
manual via WhatsApp, todas as regras de cupom da §3.4, CPF em toda inscrição e em texto
puro (§3.5).

Em aberto:
1. **Backfill do CPF** das inscrições antigas (§3.5): ok para rodar o script, depois da simulação?
2. Número do WhatsApp de suporte para reembolso.
3. Ok para implementar o plano `docs/superpowers/plans/2026-10-10-rea-6-pagamento-opa-pingou.md`.
4. Ok para merge, deploy, ligar a flag e o roteiro manual de R$ 1,00.
5. Chave `opk_live_` exposta no chat do termhub: recomenda-se rotacioná-la e digitar a nova no
   script.
6. Secrets ainda não gravados: o Pedro roda `scripts/opapingou-secrets.sh` (entrada oculta) — ele
   valida a chave com `GET /v1/me`, cadastra o endpoint e grava os dois secrets.
7. O Eventando não tem secrets de SSH no GitHub (`SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` estão só
   no BFF): roda no mesmo servidor do BFF? Sem isso o workflow `sync-secrets.yml` não tem como
   levar a chave ao `.env`.
