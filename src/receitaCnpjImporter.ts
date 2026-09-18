import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import unzipper from 'unzipper';
import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeCnpj } from './receitaCnpjIndex.js';

const prisma = new PrismaClient();
const normalize = (value?: string) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const active = (value: string) => value === '02' || /ATIV/i.test(value) ? 'ATIVA' : value.toUpperCase();
export const normalizeReceiptPhone = (ddd?: string, number?: string) => {
  const dddDigits = (ddd || '').replace(/\D/g, '');
  const numberDigits = (number || '').replace(/\D/g, '');
  if (/^(.)\1+$/.test(numberDigits)) return null;
  const value = `${dddDigits}${numberDigits}`;
  if (!value || /^0+$/.test(value) || /^(.)\1+$/.test(value) || value.length < 8 || value.length > 13) return null;
  return value;
};
const fields = (line: string) => { const out: string[] = []; let current = ''; let quoted = false; for (let i = 0; i < line.length; i += 1) { const char = line[i]; if (char === '"') { if (quoted && line[i + 1] === '"') { current += '"'; i += 1; } else quoted = !quoted; } else if (char === ';' && !quoted) { out.push(current.trim()); current = ''; } else current += char; } out.push(current.trim()); return out; };
export const parseOfficialEstablishment = (row: string[], municipality: string, businessName: string) => {
  const uf = (row[19] || '').toUpperCase();
  const cnpjBasic = normalizeCnpj(row[0]);
  const cnpjOrder = normalizeCnpj(row[1]);
  const cnpjDv = normalizeCnpj(row[2]);
  const cnpj = normalizeCnpj(`${cnpjBasic}${cnpjOrder}${cnpjDv}`);
  if (!cnpj || !municipality || !uf) return null;
  return { cnpj, cnpjBasic: cnpjBasic || null, cnpjOrder: cnpjOrder || null, cnpjDv: cnpjDv || null, branchType: row[3] || null, businessName, normalizedBusinessName: normalize(businessName), tradeName: row[4] || null, normalizedTradeName: row[4] ? normalize(row[4]) : null, status: active(row[5] || ''), cnae: row[11] || null, cnaeSecondary: row[12] || null, street: [row[13], row[14]].filter(Boolean).join(' ') || null, number: row[15] || null, complement: row[16] || null, district: row[17] || null, city: municipality, state: uf, postalCode: row[18] || null, phone1: normalizeReceiptPhone(row[21], row[22]), phone2: normalizeReceiptPhone(row[23], row[24]), email: row[27] || null };
};
const rows = async function* (stream: NodeJS.ReadableStream) { stream.setEncoding?.('latin1'); const lines = readline.createInterface({ input: stream as NodeJS.ReadableStream & AsyncIterable<string> }); for await (const line of lines) { const row = fields(String(line)); if (row.length > 1 && !/CNPJ\s*BASICO|CNPJ\s*BÁSICO/i.test(row[0])) yield row; } };
async function* sourceFiles(source: string): AsyncGenerator<{ name: string; stream: NodeJS.ReadableStream }> { const stat = await fs.stat(source); if (stat.isFile() && source.toLowerCase().endsWith('.zip')) { const archive = await unzipper.Open.file(source); for (const entry of archive.files.filter((item) => item.type === 'File')) yield { name: path.basename(entry.path), stream: entry.stream() }; return; } if (stat.isFile()) { yield { name: path.basename(source), stream: createReadStream(source) }; return; } const walk = async (dir: string): Promise<string[]> => { const result: string[] = []; for (const item of await fs.readdir(dir, { withFileTypes: true })) { const full = path.join(dir, item.name); if (item.isDirectory()) result.push(...await walk(full)); else result.push(full); } return result; }; for (const file of (await walk(source)).sort()) { if (file.toLowerCase().endsWith('.zip')) { const archive = await unzipper.Open.file(file); for (const entry of archive.files.filter((item) => item.type === 'File')) yield { name: path.basename(entry.path), stream: entry.stream() }; } else yield { name: path.basename(file), stream: createReadStream(file) }; } }
const upsertBatch = async (table: string, key: string, records: Array<Record<string, string | null>>) => { if (!records.length) return; const columns = Object.keys(records[0]); const values = records.map((record) => Prisma.sql`(${Prisma.join(columns.map((column) => record[column] === null ? Prisma.sql`NULL` : Prisma.sql`${record[column]}`))})`); const updates = columns.filter((column) => column !== key).map((column) => Prisma.sql`"${Prisma.raw(column)}" = EXCLUDED."${Prisma.raw(column)}"`); await prisma.$executeRaw(Prisma.sql`INSERT INTO "${Prisma.raw(table)}" (${Prisma.join(columns.map((column) => Prisma.sql`"${Prisma.raw(column)}"`))}) VALUES ${Prisma.join(values)} ON CONFLICT ("${Prisma.raw(key)}") DO UPDATE SET ${Prisma.join(updates)}`); };
export type ImportOptions = { source: string; uf?: string; city?: string; datasetVersion?: string };

export async function importReceitaSource(options: ImportOptions) {
  const entries = []; for await (const entry of sourceFiles(options.source)) entries.push(entry);
  const municipalities = new Map<string, string>();
  for (const entry of entries.filter((item) => /munic/i.test(item.name))) for await (const row of rows(entry.stream)) { const name = row[3] || row[2]; if (name) { municipalities.set(row[0], name); municipalities.set(row[1], name); } }
  for (const entry of entries.filter((item) => /cnae/i.test(item.name))) { const batch: Array<Record<string, string | null>> = []; for await (const row of rows(entry.stream)) { if (row[0] && row[1]) { batch.push({ code: row[0], description: row[1] }); if (batch.length >= 2000) { await upsertBatch('CnpjCnaeIndex', 'code', batch.splice(0)); } } } await upsertBatch('CnpjCnaeIndex', 'code', batch); }
  for (const entry of entries.filter((item) => /empresa/i.test(item.name) && !/estabelec/i.test(item.name))) { const batch: Array<Record<string, string | null>> = []; for await (const row of rows(entry.stream)) { if (row[0] && row[1]) { batch.push({ cnpjBasic: normalizeCnpj(row[0]), businessName: row[1] }); if (batch.length >= 2000) { await upsertBatch('CnpjCompanyIndex', 'cnpjBasic', batch.splice(0)); } } } await upsertBatch('CnpjCompanyIndex', 'cnpjBasic', batch); }
  let imported = 0; const selectedUfs = new Set<string>();
  for (const entry of entries.filter((item) => /estabelec/i.test(item.name))) { let rawBatch: string[][] = []; const flush = async () => { if (!rawBatch.length) return; const basics = [...new Set(rawBatch.map((row) => normalizeCnpj(row[0])))]; const companies = await prisma.cnpjCompanyIndex.findMany({ where: { cnpjBasic: { in: basics } }, select: { cnpjBasic: true, businessName: true } }); const companyNames = new Map(companies.map((item) => [item.cnpjBasic, item.businessName])); const batch: Array<Record<string, string | null>> = []; for (const row of rawBatch) { const uf = (row[19] || '').toUpperCase(); if (options.uf && uf !== options.uf.toUpperCase()) continue; const city = municipalities.get(row[20]); if (!city || (options.city && normalize(city) !== normalize(options.city))) continue; const record = parseOfficialEstablishment(row, city, companyNames.get(normalizeCnpj(row[0])) || ''); if (!record) continue; batch.push(record); selectedUfs.add(uf); } await upsertBatch('CnpjEstablishmentIndex', 'cnpj', batch); imported += batch.length; rawBatch = []; }; for await (const row of rows(entry.stream)) { rawBatch.push(row); if (rawBatch.length >= 2000) await flush(); } await flush(); }
  const version = options.datasetVersion || path.basename(options.source); await prisma.cnpjImportMetadata.upsert({ where: { id: 'CNPJ_RFB' }, create: { id: 'CNPJ_RFB', datasetVersion: version, datasetImportedAt: new Date(), source: options.source, establishmentCount: imported, ufs: [...selectedUfs] }, update: { datasetVersion: version, datasetImportedAt: new Date(), source: options.source, establishmentCount: imported, ufs: [...selectedUfs] } }); return { imported, datasetVersion: version, ufs: [...selectedUfs] };
}
