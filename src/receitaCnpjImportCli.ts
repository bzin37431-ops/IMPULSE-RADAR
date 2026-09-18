import { importReceitaSource } from './receitaCnpjImporter.js';

const args = process.argv.slice(2);
const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const source = value('--source') || args.find((item) => !item.startsWith('--'));
if (!source) throw new Error('Uso: npm run db:import-cnpj -- --source "pasta-ou-arquivo.zip" --uf SP [--city "Jacareí"] [--dataset-version 2026-07]');
const result = await importReceitaSource({ source, uf: value('--uf'), city: value('--city'), datasetVersion: value('--dataset-version') });
console.log(JSON.stringify(result));
