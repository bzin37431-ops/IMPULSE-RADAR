import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { PrismaClient } from '@prisma/client';
import { importReceitaSource } from './receitaCnpjImporter.js';

const SHARE_TOKEN = process.env.RECEITA_CNPJ_PUBLIC_SHARE_TOKEN || 'gn672Ad4CF8N6TK';
const ROOT = `https://arquivos.receitafederal.gov.br/public.php/dav/files/${SHARE_TOKEN}/Dados/Cadastros/CNPJ`;
const files = ['Cnaes.zip', 'Municipios.zip', ...Array.from({ length: 10 }, (_, index) => `Estabelecimentos${index}.zip`)];
const args = process.argv.slice(2);
const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const uf = value('--uf');
const requestedVersion = value('--dataset-version');
const cleanup = args.includes('--cleanup');
if (!uf) throw new Error('Uso: npm run db:sync-cnpj -- --uf SP [--dataset-version 2026-08] [--cleanup]');

const auth = `Basic ${Buffer.from(`${SHARE_TOKEN}:`).toString('base64')}`;
const request = async (url: string, init: RequestInit = {}) => {
  const response = await fetch(url, { ...init, headers: { Authorization: auth, ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`Receita HTTP ${response.status} em ${url}`);
  return response;
};
const discoverVersion = async () => {
  if (requestedVersion) return requestedVersion;
  const xml = await (await request(`${ROOT}/`, { method: 'PROPFIND', headers: { Depth: '1' } })).text();
  const versions = [...xml.matchAll(/CNPJ\/(\d{4}-\d{2})\//g)].map((match) => match[1]).sort();
  const version = versions.at(-1);
  if (!version) throw new Error('Não foi possível localizar competência CNPJ na fonte oficial.');
  return version;
};
const download = async (url: string, destination: string, expectedSize: number) => {
  const part = `${destination}.part`;
  let offset = 0;
  try { offset = (await fs.stat(part)).size; } catch { offset = 0; }
  if (offset > expectedSize) { await fs.rm(part); offset = 0; }
  if (offset === expectedSize) { await fs.rename(part, destination); return; }
  const started = Date.now();
  const response = await request(url, offset ? { headers: { Range: `bytes=${offset}-` } } : {});
  const append = offset > 0 && response.status === 206;
  if (!append) { offset = 0; await fs.rm(part, { force: true }); }
  const stream = createWriteStream(part, { flags: append ? 'a' : 'w' });
  let current = offset;
  let lastReport = 0;
  let lastReportAt = started;
  const body = response.body;
  if (!body) throw new Error(`Resposta sem conteúdo para ${url}`);
  const reader = body.getReader();
  const readable = new ReadableStream({
    async pull(controller) { const chunk = await reader.read(); if (chunk.done) controller.close(); else { current += chunk.value.byteLength; controller.enqueue(chunk.value); const now = Date.now(); if (current - lastReport >= 256 * 1024 * 1024 || now - lastReportAt > 30000) { lastReport = current; lastReportAt = now; console.log(JSON.stringify({ file: path.basename(destination), bytes: current, expectedBytes: expectedSize, percent: Number((current / expectedSize * 100).toFixed(2)), elapsedSeconds: Math.round((now - started) / 1000) })); } } },
    cancel(reason) { return reader.cancel(reason); },
  });
  await pipeline(readable, stream);
  const actualSize = (await fs.stat(part)).size;
  if (actualSize !== expectedSize) throw new Error(`Download incompleto ${path.basename(destination)}: ${actualSize}/${expectedSize}`);
  await fs.rename(part, destination);
};

const version = await discoverVersion();
const downloadDir = path.resolve('data', 'cnpj', 'downloads', version);
await fs.mkdir(downloadDir, { recursive: true });
const listing = await (await request(`${ROOT}/${version}/`, { method: 'PROPFIND', headers: { Depth: '1' } })).text();
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sizeFor = (name: string) => {
  const match = listing.match(new RegExp(`<d:href>[^<]*\\/${escapeRegExp(name)}<\\/d:href>[\\s\\S]*?<d:getcontentlength>(\\d+)<\\/d:getcontentlength>`));
  if (!match) throw new Error(`Arquivo não encontrado na competência oficial: ${name}`);
  return Number(match[1]);
};
const manifest: Array<{ name: string; size: number; path: string }> = [];
for (const name of files) {
  const url = `${ROOT}/${version}/${encodeURIComponent(name)}`;
  const entry = { name, size: sizeFor(name) };
  const destination = path.join(downloadDir, name);
  manifest.push({ name, size: entry.size, path: destination });
}
const totalDownloadBytes = manifest.reduce((sum, entry) => sum + entry.size, 0);
const disk = await fs.statfs(downloadDir);
const freeBytes = Number(disk.bavail) * Number(disk.bsize);
if (totalDownloadBytes > 10 * 1024 ** 3 || freeBytes < totalDownloadBytes + 1024 ** 3) throw new Error(`Operação pausada por segurança de disco: download=${totalDownloadBytes} bytes, livre=${freeBytes} bytes.`);
console.log(JSON.stringify({ event: 'download_plan', version, files: manifest.map(({ name, size }) => ({ name, size })), totalDownloadBytes, freeBytes }));
for (const entry of manifest) {
  const url = `${ROOT}/${version}/${encodeURIComponent(entry.name)}`;
  console.log(JSON.stringify({ event: 'download_start', version, file: entry.name, expectedBytes: entry.size }));
  await download(url, entry.path, entry.size);
}
const result = await importReceitaSource({ source: downloadDir, uf, datasetVersion: version });
const prisma = new PrismaClient();
const [total, active, phone1, phone2, phoneAny, email] = await Promise.all([
  prisma.cnpjEstablishmentIndex.count({ where: { state: uf.toUpperCase() } }),
  prisma.cnpjEstablishmentIndex.count({ where: { state: uf.toUpperCase(), status: 'ATIVA' } }),
  prisma.cnpjEstablishmentIndex.count({ where: { state: uf.toUpperCase(), phone1: { not: null } } }),
  prisma.cnpjEstablishmentIndex.count({ where: { state: uf.toUpperCase(), phone2: { not: null } } }),
  prisma.cnpjEstablishmentIndex.count({ where: { state: uf.toUpperCase(), OR: [{ phone1: { not: null } }, { phone2: { not: null } }] } }),
  prisma.cnpjEstablishmentIndex.count({ where: { state: uf.toUpperCase(), email: { not: null } } }),
]);
console.log(JSON.stringify({ event: 'import_complete', version, files: manifest, ...result, total, active, phone1, phone2, phoneAny, email }));
if (cleanup) for (const entry of manifest) await fs.rm(entry.path, { force: true });
await prisma.$disconnect();
