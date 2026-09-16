# Impulse Connect

CRM de leads e atendimento da Impulse Sites, usando exclusivamente a WhatsApp Business Platform / WhatsApp Cloud API oficial da Meta.

## Execução local

Requisitos: Node.js 20+, Docker e npm.

```powershell
Copy-Item .env.example .env
docker compose up -d postgres redis
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

A SPA roda em `http://localhost:5173`; a API, em `http://localhost:3000`. `setup.ps1` e `setup.sh` automatizam esses passos. Para CI: `npm run typecheck`, `npm test` e `npm run build`.

## Meta Cloud API

Crie um Meta Developer App com o produto WhatsApp e configure `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` e `META_GRAPH_API_VERSION`. Aponte o callback para `GET/POST /webhooks/whatsapp`. Em produção use HTTPS, secrets no provedor, `TEST_MODE=false`, `NODE_ENV=production` e `PROVIDER_MODE=meta-cloud-api`. O Official API Guard encerra o processo se outro provider for configurado.

`TEST_MODE=true` usa `MockWhatsAppProvider`, nunca chama a Meta e é indicado para desenvolvimento. Não há fallback para WhatsApp Web, QR code, Selenium, Playwright, Baileys ou outras APIs não oficiais.

## Operação

O backend cobre leads, duplicidade por telefone/empresa/Instagram, pipeline, timeline, notas, consentimento, opt-out, importação, exportação CSV/JSON, conversas, janela de 24h, templates, endpoint público de leads, health check, controles de fila e pausa de emergência. Envio usa idempotency key, fila com concorrência limitada e circuit breaker; opt-out bloqueia automaticamente a operação. O schema Prisma PostgreSQL contém User, Lead, LeadNote, LeadHistory, Conversation, Message, Campaign, CampaignRecipient, Template, Consent, OptOut, Task, WebhookEvent, AuditLog e SystemSetting.

## Segurança e produção

Schemas são validados com Zod, Helmet/CORS estão ativos, JWT é assinado no backend e logs possuem redaction de credenciais. Tokens nunca são enviados ao frontend. Ative rate limiting no gateway/API manager, use cookies HttpOnly para a sessão do frontend, configure origem exata, rotação de segredos, backups PITR/diários do PostgreSQL e restauração testada. Migrações são versionadas em `prisma/migrations`; não use `db push` em produção.

## Rotas

`GET /health`, `POST /api/auth/login`, `GET/POST/PATCH/DELETE /api/leads`, `POST /api/leads/import`, `GET /api/leads/export`, `GET /api/dashboard`, `GET /api/templates`, `POST /api/templates/sync`, `GET /api/settings/whatsapp`, `POST /api/settings/whatsapp/test`, `POST /api/settings/pause`, `POST /api/settings/resume`, `GET/POST /api/conversations`, `POST /api/public/leads` e `GET/POST /webhooks/whatsapp`.
