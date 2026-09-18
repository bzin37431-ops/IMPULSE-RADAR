import { spawnSync } from 'node:child_process';

if (!process.env.VERCEL) {
  process.exit(0);
}

const databaseUrl = process.env.RADAR_DATABASE_DATABASE_URL || process.env.RADAR_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log('[vercel-migrate] Nenhum banco de produção configurado; migrations ignoradas.');
  process.exit(0);
}

console.log('[vercel-migrate] Aplicando migrations Prisma no banco do Impulse Radar...');
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});

if (result.error) {
  console.error('[vercel-migrate] Falha ao iniciar Prisma:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
