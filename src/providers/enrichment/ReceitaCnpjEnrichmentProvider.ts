import { PrismaClient } from '@prisma/client';
import { env } from '../../config.js';
import { normalizePhone } from '../../domain.js';
import { DiscoveryBusiness, DiscoveryQuery } from '../discovery/DiscoveryProvider.js';
import { WebSearchEvidence } from '../discovery/WebSearchDiscoveryProvider.js';

const prisma = new PrismaClient();
const normalize = (value?: string | null) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const tokens = (value: string) => new Set((value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
const overlap = (left: string, right?: string | null) => { const a = tokens(left); const b = tokens(right || ''); return a.size ? [...a].filter((item) => b.has(item)).length / a.size : 0; };
const stateCode = (value: string) => ({ 'sao paulo': 'SP', 'rio de janeiro': 'RJ', 'minas gerais': 'MG', 'parana': 'PR', 'bahia': 'BA', 'santa catarina': 'SC', 'rio grande do sul': 'RS', 'pernambuco': 'PE', 'ceara': 'CE', 'goias': 'GO', 'para': 'PA', 'espirito santo': 'ES', 'maranhao': 'MA', 'paraiba': 'PB', 'amazonas': 'AM', 'mato grosso': 'MT', 'rio grande do norte': 'RN', 'alagoas': 'AL', 'piaui': 'PI', 'distrito federal': 'DF', 'mato grosso do sul': 'MS', 'sergipe': 'SE', 'rondonia': 'RO', 'acre': 'AC', 'tocantins': 'TO', 'amapa': 'AP', 'roraima': 'RR' }[normalize(value)] || value.slice(0, 2).toUpperCase());

export type ReceitaMatch = { cnpj: string; matchConfidence: 'EXACT' | 'HIGH' | 'MEDIUM' | 'LOW'; score: number };
export type ReceitaIndexedRow = { cnpj: string; businessName: string; tradeName: string | null; district: string | null; postalCode: string | null; street: string | null };
export function evaluateReceitaMatch(business: DiscoveryBusiness, row: ReceitaIndexedRow): ReceitaMatch & { candidateName: string; postal: boolean; district: boolean; address: boolean } {
  const name = normalize(business.name);
  const candidateName = row.tradeName || row.businessName;
  const exactName = normalize(row.tradeName) === name || normalize(row.businessName) === name;
  const nameScore = exactName ? 1 : Math.max(overlap(business.name, row.tradeName || ''), overlap(business.name, row.businessName));
  const postal = Boolean(business.postalCode && row.postalCode && normalize(business.postalCode) === normalize(row.postalCode));
  const postalConflict = Boolean(business.postalCode && row.postalCode && !postal);
  const district = Boolean(business.district && row.district && normalize(business.district) === normalize(row.district));
  const address = Boolean(business.address && row.street && normalize(business.address).includes(normalize(row.street)));
  const score = (exactName ? 55 : Math.round(nameScore * 40)) + (postal ? 25 : 0) + (district ? 10 : 0) + (address ? 10 : 0) + 20 - (postalConflict ? 35 : 0);
  const matchConfidence = exactName && (postal || district || address) && !postalConflict ? 'EXACT' : score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW';
  return { cnpj: row.cnpj, candidateName, score, matchConfidence, postal, district, address };
}

export class ReceitaCnpjEnrichmentProvider {
  getProviderName() { return 'RECEITA_CNPJ'; }
  isConfigured() { return Boolean(env.DATABASE_URL); }
  getRateLimitInfo() { return { configured: this.isConfigured() }; }
  async count() { return prisma.cnpjEstablishmentIndex.count(); }
  async getIntegrationStatus() { try { return (await this.count()) > 0 ? 'Ativo' : 'Base não importada'; } catch { return 'Erro'; } }
  async getLastUpdatedAt() { const latest = await prisma.cnpjEstablishmentIndex.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }); return latest?.updatedAt.toISOString(); }
  async getMetadata() { return prisma.cnpjImportMetadata.findUnique({ where: { id: 'CNPJ_RFB' }, select: { datasetVersion: true, datasetImportedAt: true, source: true, establishmentCount: true, ufs: true } }); }

  async enrich(business: DiscoveryBusiness, _query: DiscoveryQuery): Promise<WebSearchEvidence[]> {
    if (!this.isConfigured()) return [];
    const name = normalize(business.name);
    const nameTokens = [...tokens(business.name)].filter((item) => item.length >= 4).slice(0, 3);
    if (!name || !nameTokens.length) return [];
    const rows = await prisma.cnpjEstablishmentIndex.findMany({
      where: {
        status: 'ATIVA',
        city: { contains: business.city, mode: 'insensitive' },
        state: { equals: stateCode(business.state), mode: 'insensitive' },
        OR: nameTokens.flatMap((token) => [{ normalizedTradeName: { contains: token } }, { normalizedBusinessName: { contains: token } }]),
      },
      take: 50,
    });
    const matches = rows.map((row) => ({ row, ...evaluateReceitaMatch(business, row) })).filter((item) => item.matchConfidence === 'EXACT' || item.matchConfidence === 'HIGH').sort((a, b) => b.score - a.score);
    if (!matches.length || (matches[1] && matches[0].score - matches[1].score < 8)) return [];
    const match = matches[0];
    const phone = normalizePhone(match.row.phone1 || undefined) || normalizePhone(match.row.phone2 || undefined);
    return [{ name: match.candidateName, city: match.row.city, state: match.row.state, district: match.row.district || undefined, address: [match.row.street, match.row.number].filter(Boolean).join(', ') || undefined, email: match.row.email || undefined, emailSource: match.row.email ? 'RECEITA_CNPJ' : undefined, phone, phoneSourceId: match.row.cnpj, confidence: phone ? match.matchConfidence : undefined, matchConfidence: match.matchConfidence, externalIds: { cnpj: match.row.cnpj } }];
  }
}
