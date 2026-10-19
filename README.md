# EMPREST.AI — API

NestJS + Express, publicada na Vercel como function (`api/index.ts`).
Rotas sob `/v1`. Auth: JWT do Supabase validado por JWKS.

## Rodar local
1. Banco/Auth locais: `supabase start` (na raiz do workspace).
2. `cp .env.example .env` e ajuste se preciso.
3. `npm install` · `npm run start:dev` → http://localhost:3000/v1/health

## Rotas
- `GET /v1/health` — sem token.
- `GET /v1/me` — `Authorization: Bearer <jwt>`; devolve `{ id, email }`.

## Variáveis
Ver `.env.example`. Todas também precisam existir no painel da Vercel.
