# REA-6 — Inscrição paga com o Opa Pingou: levantamento e desenho proposto

Status: **bloqueado antes da implementação** (faltam contrato do Opa Pingou e decisões de produto).
Data: 2026-10-10.

## 1. O que já existe no Hub (fluxo atual de lote pago)

Inscrições, lotes e pagamentos **não** ficam no hub-community-backend; ficam no
**Eventando Manager** (Strapi 4, `reactivando/eventando-manager`), acessado pelo BFF via
`EVENTANDO_MANAGER_URL`.

- Modelo: Event → `Product` (tipo de ingresso) → `Batch` (lote, `value` biginteger em **centavos**,
  `max_quantity`, `valid_from/until`, `enabled`). `Signup` 1:1 `Payment`
  (`status`: `PEDING_PAYMENT | CANCELED | CONFIRMED | REFUND`, `pix_qr_code`, `payment_link`,
  `payment_identification`). Lote gratuito = `value = 0`.
- Inscrição: `signupToEvent` (BFF, `src/resolvers/Event/index.js`) → `POST /signup/:id`
  (Eventando `signup.customCreate`). Valida lote/validade/estoque/vagas/cupom/meia; se pago, cria a
  cobrança no **PixAI** (`pixai_token_integration` por evento) e grava o `Payment` pendente.
- Confirmação: webhook `POST /api/payment/integration` (Eventando) reage a
  `payment_initiation/completed` e marca `CONFIRMED`. **Sem verificação de assinatura.**
- Frontend: `src/app/events/[id]/signup/page.tsx` mostra QR Pix / link de cartão no passo
  `payment`; não faz polling do status.
- Admin: preço do lote já existe (`batch-form-dialog.tsx`, "Valor (R$)").

Ou seja, o item 1 do card (lote com preço) e boa parte do item 2 já existem com o PixAI.
O trabalho do REA-6 é **trocar/acrescentar o provedor** e endurecer webhook e estados.

### Problemas encontrados no fluxo atual (independentes do Opa Pingou)

1. **Unidade do preço divergente (bug):** o admin digita reais (`step="0.01"`) e envia
   `Number(b.value)` sem converter (`admin/events/[id]/page.tsx:111`, `new/page.tsx:57`); a página
   pública e o PixAI tratam como centavos (`signup/page.tsx:628` divide por 100). Um lote de
   R$ 50 cadastrado pelo admin aparece como R$ 0,50 e seria cobrado assim.
2. Webhook do Eventando sem assinatura: qualquer um que saiba o `payment_identification` confirma.
3. `isUserSignedUp` (BFF) conta inscrição com pagamento pendente como inscrito.
4. Pagamento pendente nunca expira: a vaga fica presa para sempre (estoque conta `PEDING_PAYMENT`).

## 2. O que o Opa Pingou oferece hoje (monorepo `opapingou/monorepo`, main `973e2d2`)

- API **GraphQL** NestJS. `createCharge(input: { amountCents, description, validity
  (FIFTEEN_MIN|ONE_HOUR|ONE_DAY|SEVEN_DAYS), kind (PIX_QR|PAYMENT_LINK), bankAccountId })`
  → `Charge { id, status (PENDING|PAID|EXPIRED|CANCELED), brCode, paymentLink, expiresAt, ... }`.
- **Autenticação só por usuário**: login por código enviado por e-mail → JWT de 15 min + refresh de
  30 dias. Exige onboarding com CPF/CNPJ. **Não há chave de API de comerciante.**
- **Não há webhook de saída** para comerciantes (só push no celular "Opa, pingou!"). As linhas
  "Chaves de API" e "Webhook 'pingou'" estão como "em breve" no app.
- Sem `external_reference`/metadata, sem dados do pagador, sem idempotência, sem URL de retorno
  configurável, sem reembolso; `cancelCharge` só marca no banco.
- Sem sandbox de comerciante; existe `SIMULATION_ENABLED` + `simulateChargePayment` (local/staging)
  e staging em `api-stg.opapingou.com.br` (apontando para hosts Pix de produção dos bancos).

Conclusão: os itens 3 (webhook com assinatura e idempotência) e 6 (credencial de servidor com
sandbox) do card **não têm como ser atendidos sem trabalho novo no Opa Pingou**, e o card proíbe
inventar endpoints.

## 3. Desenho proposto (quando houver contrato)

### 3.1 Pré-requisitos no Opa Pingou (outro projeto/repo)
1. Chave de API de comerciante (servidor-a-servidor), com chave de teste separada da de produção.
2. `createCharge` aceitar `externalReference` (id do `Payment` do Eventando) e, opcional, dados do
   pagador e `idempotencyKey`.
3. Webhook de saída por conta: eventos `charge.paid`, `charge.expired`, `charge.canceled`
   (e futuramente `charge.refunded`), payload com `eventId` único, `chargeId`,
   `externalReference`, `status`, `amountCents`, `paidAt`; assinatura
   `X-OpaPingou-Signature: t=<ts>,v1=<hex HMAC-SHA256(secret, "<ts>.<rawBody>")>`; reenvio com
   backoff.
4. `charge(id)` consultável pela chave de API (o Hub reconsulta o status antes de confirmar).

### 3.2 No Hub
- **Eventando Manager:** adaptador de provedor (`pixai` | `opapingou`) escolhido por evento
  (campo `payment_provider`); `customCreate` cria a cobrança no Opa Pingou com
  `externalReference = payment_identification` e validade definida; novo
  `POST /payment/opapingou/webhook` que verifica a assinatura sobre o corpo cru, rejeita
  timestamp com mais de 5 min, registra o `eventId` (único) em `PaymentIntegration` para
  idempotência, **reconsulta** `charge(id)` e só então marca `CONFIRMED`/`CANCELED`. Pendente que
  expira libera a vaga.
- **BFF:** query `signupPaymentStatus(signupId)` para o polling; `isUserSignedUp` passa a expor o
  status do pagamento; e-mail de confirmação (com QR do ingresso) só após `CONFIRMED`.
- **Frontend:** passo `payment` com QR (`brCode`) + link, polling a cada 3 s até
  pago/expirado; estados "pagamento pendente / pago / expirado" para o participante e na lista de
  inscritos do admin; correção da unidade do preço (reais no formulário ↔ centavos no
  armazenamento).
- Segredos (`OPAPINGOU_API_KEY`, `OPAPINGOU_WEBHOOK_SECRET`, `OPAPINGOU_API_URL`) só no Eventando
  Manager; nunca no navegador.

## 4. Decisões de produto pendentes (Pedro)

1. Caminho: (a) implementar primeiro, no Opa Pingou, chave de API + webhook assinado + referência
   externa; (b) integrar já com o JWT de um usuário do Opa Pingou + polling (sem webhook — viola o
   item 3 do card e guarda um refresh token de 30 dias no servidor); (c) para o meetup de 07/11,
   usar o fluxo PixAI que já existe e deixar o Opa Pingou para depois.
2. Métodos aceitos: só Pix QR, ou também link Mercado Pago (cartão)?
3. Conta que recebe: qual conta bancária conectada do Opa Pingou (de qual usuário/CNPJ)?
4. Validade da cobrança e quanto tempo a vaga fica reservada (15 min? 1 h?).
5. Reembolso/cancelamento: o Opa Pingou não tem estorno; reembolso manual fora do sistema?
6. Valor da inscrição do meetup de 07/11.
