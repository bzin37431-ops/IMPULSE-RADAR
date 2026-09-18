import { env } from '../../config.js';
import { normalizePhone } from '../../domain.js';
import { DiscoveryBusiness, DiscoveryQuery } from '../discovery/DiscoveryProvider.js';
import { WebSearchEvidence } from '../discovery/WebSearchDiscoveryProvider.js';

type CnpjWsPayload = { cnpj?: string; estabelecimento?: { cnpj?: string; nome_fantasia?: string; telefone1?: string; telefone2?: string; email?: string; cidade?: { nome?: string }; estado?: { sigla?: string }; bairro?: string; logradouro?: string; numero?: string } };
const cache = new Map<string, { expiresAt: number; evidence: WebSearchEvidence[] }>();
const TTL = 7 * 24 * 60 * 60 * 1000;
let globalLastRequestAt = 0;
const normalize = (value?: string) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export class CnpjWsProvider {
  private requestCount = 0;
  getProviderName() { return 'CNPJ_WS'; }
  isConfigured() { return env.CNPJWS_ENRICHMENT_ENABLED; }
  getRequestCount() { return this.requestCount; }
  async enrich(business: DiscoveryBusiness, _query: DiscoveryQuery): Promise<WebSearchEvidence[]> {
    if (!this.isConfigured()) return [];
    const cnpj = business.externalIds?.cnpj?.replace(/\D/g, '');
    if (!cnpj) return [];
    const cached = cache.get(cnpj);
    if (cached && cached.expiresAt > Date.now()) return cached.evidence;
    const wait = Math.max(0, 20000 - (Date.now() - globalLastRequestAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    globalLastRequestAt = Date.now();
    this.requestCount += 1;
    const response = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, { headers: { accept: 'application/json', 'user-agent': 'ImpulseProspect/1.0' }, signal: AbortSignal.timeout(8000) });
    if (response.status === 429) return [];
    if (!response.ok) return [];
    const payload = await response.json() as CnpjWsPayload;
    const item = payload.estabelecimento;
    if (!item) return [];
    const name = item.nome_fantasia || business.name;
    const city = item.cidade?.nome || business.city;
    if (normalize(city) !== normalize(business.city) || (!normalize(name).includes(normalize(business.name)) && !normalize(business.name).includes(normalize(name)))) return [];
    const evidence = [{ name, city, state: item.estado?.sigla || business.state, district: item.bairro, address: [item.logradouro, item.numero].filter(Boolean).join(', ') || undefined, phone: normalizePhone(item.telefone1) || normalizePhone(item.telefone2), phoneSourceId: cnpj, phoneSourceUrl: `https://publica.cnpj.ws/cnpj/${cnpj}`, email: item.email, emailSource: item.email ? 'CNPJ_WS' : undefined, confidence: 'HIGH', matchConfidence: 'HIGH', externalIds: { cnpj } }];
    cache.set(cnpj, { expiresAt: Date.now() + TTL, evidence });
    return evidence;
  }
}
