---
symptom: "A foto do organizador não aparece em /communities/<slug> (só a inicial do username)"
tags: [avatar, foto, organizador, comunidade, populate, strapi, bff]
evidence: fixed
card: REA-54
agent: claude
date: 2026-11-15
---
## Causa

A foto de uma pessoa não fica no `User`: é o `avatar` do perfil de palestrante dela (`user.speaker.avatar`,
o que `/profile/edit` grava). O tipo `User` do BFF nem tem campo `avatar` (só o `ProfileInput`). Na página
da comunidade faltavam as três pontas: o card dos organizadores só desenhava a inicial, a query
`GetCommunityBySlugOrId` não pedia `speaker { avatar }` e o BFF populava só `organizers`, então o Strapi
devolvia `speaker: null` mesmo para quem tem foto (`userByUsername` vinha certo porque popula
`speaker.avatar`). Não era URL relativa nem domínio de imagem do Next (`images.unoptimized`).

## Correção

- BFF: `COMMUNITY_POPULATE` em `resolvers/Community` com `organizers.speaker` e `organizers.speaker.avatar`
  (o `Speaker.avatar` já transforma a mídia em URL absoluta).
- Front: a query pede `organizers { name speaker { avatar } }` e `CommunityOrganizers` mostra a foto,
  com a inicial quando não há foto ou ela não carrega.

## Como conferir

`curl -s https://bff.hubcommunity.io/graphql -H 'content-type: application/json' -d '{"query":"{ communityBySlugOrId(slugOrId:\"techstars\"){ organizers { username speaker { avatar } } } }"}'`
devolve `speaker.avatar` preenchido (antes: `speaker: null`). Testes: `src/components/__tests__/community-organizers.test.tsx`
(front) e `src/resolvers/Community/index.test.js` (BFF).
