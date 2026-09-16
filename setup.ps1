$ErrorActionPreference = 'Stop'
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d postgres redis
npm install
npm run db:migrate
npm run db:seed
Write-Host 'Impulse Connect pronto. Execute npm run dev.'
