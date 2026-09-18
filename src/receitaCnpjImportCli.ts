import fs from 'node:fs/promises';
import { ReceitaCnpjIndexService, ReceitaCnpjRecord } from './receitaCnpjIndex.js';

const file = process.argv[2];
if (!file) throw new Error('Uso: npm run db:import-cnpj -- caminho/para/estabelecimentos.json');
const raw = await fs.readFile(file, 'utf8');
const parsed = JSON.parse(raw) as ReceitaCnpjRecord[];
if (!Array.isArray(parsed)) throw new Error('O arquivo deve conter um array JSON de estabelecimentos cadastrais.');
const imported = await new ReceitaCnpjIndexService().importRecords(parsed);
console.log(`Estabelecimentos importados/atualizados: ${imported}`);
