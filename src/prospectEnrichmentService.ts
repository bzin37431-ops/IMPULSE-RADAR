import { normalizePhone } from './domain.js';
import { DiscoveryBusiness, DiscoveryQuery } from './providers/discovery/DiscoveryProvider.js';
import { WebSearchEvidence } from './providers/discovery/WebSearchDiscoveryProvider.js';

type EnrichmentProvider = { getProviderName(): string; isConfigured(): boolean; enrich?: (business: DiscoveryBusiness, query: DiscoveryQuery) => Promise<WebSearchEvidence[]>; search?: (query: string, context?: { name: string; city: string; state: string; district?: string; address?: string }) => Promise<WebSearchEvidence[]> };
export type EnrichmentResult = { business: DiscoveryBusiness; attempted: boolean; foundPhone: boolean; source?: string; attemptedProviders: string[]; matchedProviders: string[] };
type CacheEntry = { expiresAt: number; result: EnrichmentResult };

const cache = new Map<string, CacheEntry>();
const TTL = 24 * 60 * 60 * 1000;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const identityKey = (business: DiscoveryBusiness) => Object.values(business.externalIds || {})[0] || `${normalize(business.name)}:${normalize(business.city)}:${normalize(business.address || '')}`;
const same = (left?: string, right?: string) => !left || !right || normalize(left) === normalize(right);

export class ProspectEnrichmentService {
  private readonly providers: EnrichmentProvider[];
  constructor(provider?: EnrichmentProvider | EnrichmentProvider[]) { this.providers = (Array.isArray(provider) ? provider : provider ? [provider] : []); }
  private matches(business: DiscoveryBusiness, evidence: WebSearchEvidence) {
    if (!same(business.name, evidence.name) || !same(business.city, evidence.city) || !same(business.state, evidence.state)) return false;
    if (evidence.matchConfidence === 'EXACT' || evidence.matchConfidence === 'HIGH') return true;
    return same(business.district, evidence.district) && (!evidence.address || same(business.address, evidence.address));
  }
  private queries(business: DiscoveryBusiness) {
    const context = [business.name, business.city, business.district, business.address].filter(Boolean).map((item) => `"${item}"`).join(' ');
    return [`${context} telefone`, `${context} contato`, `${context} Instagram`, `${context} site`];
  }
  async enrich(business: DiscoveryBusiness, query: DiscoveryQuery): Promise<EnrichmentResult> {
    if (business.phone) return { business: { ...business, phoneSource: business.phoneSource || 'GEOAPIFY', phoneConfidence: business.phoneConfidence || 'CONFIRMED', phoneVerifiedAt: business.phoneVerifiedAt || new Date().toISOString(), enrichmentAttempted: false }, attempted: false, foundPhone: true, source: business.phoneSource || 'GEOAPIFY', attemptedProviders: [], matchedProviders: [] };
    const key = identityKey(business);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    let current = { ...business };
    const attemptedProviders: string[] = [];
    const matchedProviders: string[] = [];
    let source: string | undefined;
    let foundPhone = false;
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      const providerName = provider.getProviderName();
      attemptedProviders.push(providerName);
      const evidence: WebSearchEvidence[] = provider.enrich
        ? await provider.enrich(current, query)
        : (await Promise.all(this.queries(current).map((searchQuery) => provider.search?.(searchQuery, { name: current.name, city: current.city, state: current.state, district: current.district, address: current.address }) || Promise.resolve([])))).flat();
      const matchingEvidence = evidence.filter((item) => this.matches(current, item));
      if (!matchingEvidence.length) continue;
      matchedProviders.push(providerName);
      const match = matchingEvidence.find((item) => item.phone && normalizePhone(item.phone)) || matchingEvidence[0];
      current = { ...current, ...this.applyEvidence(current, match, providerName), enrichmentAttempted: true, enrichmentSource: providerName };
      const phone = matchingEvidence.find((item) => item.phone && normalizePhone(item.phone));
      if (phone && (phone.matchConfidence === 'EXACT' || phone.matchConfidence === 'HIGH' || providerName !== 'RECEITA_CNPJ')) {
        foundPhone = true;
        source = providerName;
        break;
      }
    }
    const result: EnrichmentResult = { business: { ...current, enrichmentAttempted: attemptedProviders.length > 0 }, attempted: attemptedProviders.length > 0, foundPhone, source, attemptedProviders, matchedProviders };
    cache.set(key, { expiresAt: Date.now() + TTL, result });
    return result;
  }
  private applyEvidence(business: DiscoveryBusiness, evidence: WebSearchEvidence, providerName: string): Partial<DiscoveryBusiness> {
    const phone = evidence.phone && normalizePhone(evidence.phone);
    return { externalIds: { ...business.externalIds, ...evidence.externalIds }, ...(phone ? { phone, phoneSource: providerName, phoneSourceId: evidence.phoneSourceId, phoneSourceUrl: evidence.phoneSourceUrl, phoneConfidence: evidence.confidence || evidence.matchConfidence || 'CONFIRMED', phoneVerifiedAt: new Date().toISOString() } : {}), website: business.website || evidence.website, instagram: business.instagram || evidence.instagram, facebook: business.facebook || evidence.facebook, email: business.email || evidence.email, emailSource: evidence.emailSource || (evidence.email ? providerName : business.emailSource) };
  }
}
