#!/usr/bin/env bash
set -euo pipefail
[[ -f .env ]] || cp .env.example .env
docker compose up -d postgres redis
npm install
npm run db:migrate
npm run db:seed
echo 'Impulse Connect pronto. Execute npm run dev.'
