# Impulse Radar

Radar de prospecção real de empresas, com Geoapify como descoberta principal, Receita Federal CNPJ local como enriquecimento prioritário e Tavily como último fallback.

## Execução local

Requisitos: Node.js 20+, Docker e npm.

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

A SPA roda em `http://localhost:5173`; a API, em `http://localhost:3000`. `setup.ps1` e `setup.sh` automatizam esses passos. O projeto usa PostgreSQL para persistência e Redis/BullMQ para filas. Para CI: `npm run typecheck`, `npm test` e `npm run build`.

O serviço `api` do Compose executa `prisma migrate deploy` antes de iniciar o backend. Em desenvolvimento local, `npm run db:migrate` continua disponível para aplicar migrations explicitamente.

## Meta Cloud API

Crie um Meta Developer App com o produto WhatsApp e configure `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` e `META_GRAPH_API_VERSION`. Aponte o callback para `GET/POST /webhooks/whatsapp`. Em produção use HTTPS, secrets no provedor, `TEST_MODE=false`, `NODE_ENV=production` e `PROVIDER_MODE=meta-cloud-api`. O Official API Guard encerra o processo se outro provider for configurado.

`TEST_MODE=true` usa `MockWhatsAppProvider`, nunca chama a Meta e é indicado para desenvolvimento. Não há fallback para WhatsApp Web, QR code, Selenium, Playwright, Baileys ou outras APIs não oficiais.

## Geoapify Discovery

A descoberta real usa Geoapify Places API e Geocoding API no backend. Configure `DISCOVERY_MODE=real`, `DISCOVERY_TEST_MODE=false` e `GEOAPIFY_API_KEY` como segredo do servidor (localmente no `.env`; em produção, nas variáveis do serviço). Nunca use `VITE_GEOAPIFY_API_KEY`: a chave não é enviada ao navegador. O modo real não usa `MockDiscoveryProvider`; empresas sem telefone retornado pela fonte são descartadas e não são substituídas por dados fictícios. Google Places permanece opcional.

## Receita Federal CNPJ

O pipeline de busca é `Geoapify → Receita Federal local → OSM/contact → CNPJ.ws → Tavily`. A base CNPJ não fica no GitHub: os ZIPs e o diretório `data/cnpj/` são ignorados pelo Git e os dados permanecem no PostgreSQL do ambiente.

Para sincronizar uma competência oficial e importar uma UF:

```powershell
npm run db:sync-cnpj -- --uf SP
```

Para importar arquivos já baixados:

```powershell
npm run db:import-cnpj -- --source data/cnpj/downloads/2026-08 --uf SP --dataset-version 2026-08
```

O importador processa ZIPs em streaming, usa lotes/upsert idempotente, resolve municípios oficiais, preserva CNPJs como strings (incluindo o formato alfanumérico) e mantém registros inativos sem os usar para matching automático. Não são importados dados de QSA.

## Radar e layouts

O modo real requer `DISCOVERY_MODE=real`, `DISCOVERY_TEST_MODE=false` e `GEOAPIFY_API_KEY` somente no backend. `TAVILY_API_KEY` também é somente servidor e serve para enriquecer candidatos sem telefone depois das fontes locais. Em modo real, `MockDiscoveryProvider` não é usado. O mapa usa MapLibre com coordenadas reais e layouts salvos são persistidos no PostgreSQL.

## Operação

O backend cobre leads, duplicidade por telefone/empresa/Instagram, pipeline, timeline, notas, consentimento, opt-out, importação, exportação CSV/JSON, conversas, janela de 24h, templates, endpoint público de leads, health check, controles de fila e pausa de emergência. Envio usa idempotency key, fila com concorrência limitada e circuit breaker; opt-out bloqueia automaticamente a operação. O schema Prisma PostgreSQL contém User, Lead, LeadNote, LeadHistory, Conversation, Message, Campaign, CampaignRecipient, Template, Consent, OptOut, Task, WebhookEvent, AuditLog e SystemSetting.

## Segurança e produção

Schemas são validados com Zod, Helmet/CORS estão ativos, JWT é assinado no backend e logs possuem redaction de credenciais. Tokens nunca são enviados ao frontend. Ative rate limiting no gateway/API manager, use cookies HttpOnly para a sessão do frontend, configure origem exata, rotação de segredos, backups PITR/diários do PostgreSQL e restauração testada. Migrações são versionadas em `prisma/migrations`; não use `db push` em produção.

## Rotas

`GET /health`, `POST /api/auth/login`, `GET/POST/PATCH/DELETE /api/leads`, `POST /api/leads/import`, `GET /api/leads/export`, `GET /api/dashboard`, `GET /api/templates`, `POST /api/templates/sync`, `GET /api/settings/whatsapp`, `POST /api/settings/whatsapp/test`, `POST /api/settings/pause`, `POST /api/settings/resume`, `GET/POST /api/conversations`, `POST /api/public/leads` e `GET/POST /webhooks/whatsapp`.
