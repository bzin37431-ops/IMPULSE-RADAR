import { normalizePhone } from './domain.js';
import { DiscoveryBusiness, DiscoveryQuery } from './providers/discovery/DiscoveryProvider.js';
import { WebSearchEvidence, WebSearchProvider } from './providers/discovery/WebSearchDiscoveryProvider.js';

export type EnrichmentResult = { business: DiscoveryBusiness; attempted: boolean; foundPhone: boolean; source?: string };
type CacheEntry = { expiresAt: number; result: EnrichmentResult };

const cache = new Map<string, CacheEntry>();
const TTL = 24 * 60 * 60 * 1000;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const identityKey = (business: DiscoveryBusiness) => Object.values(business.externalIds || {})[0] || `${normalize(business.name)}:${normalize(business.city)}:${normalize(business.address || '')}`;
const same = (left?: string, right?: string) => !left || !right || normalize(left) === normalize(right);

export class ProspectEnrichmentService {
  constructor(private readonly provider?: WebSearchProvider) {}
  private matches(business: DiscoveryBusiness, evidence: WebSearchEvidence) {
    return same(business.name, evidence.name) && same(business.city, evidence.city) && same(business.state, evidence.state) && same(business.district, evidence.district) && (!evidence.address || same(business.address, evidence.address));
  }
  private queries(business: DiscoveryBusiness) {
    const context = [business.name, business.city, business.district, business.address].filter(Boolean).map((item) => `"${item}"`).join(' ');
    return [`${context} telefone`, `${context} contato`, `${context} Instagram`, `${context} site`];
  }
  async enrich(business: DiscoveryBusiness, query: DiscoveryQuery): Promise<EnrichmentResult> {
    if (business.phone) return { business: { ...business, phoneSource: business.phoneSource || 'GEOAPIFY', phoneConfidence: business.phoneConfidence || 'CONFIRMED', phoneVerifiedAt: business.phoneVerifiedAt || new Date().toISOString(), enrichmentAttempted: false }, attempted: false, foundPhone: true, source: business.phoneSource || 'GEOAPIFY' };
    if (!this.provider?.isConfigured()) return { business: { ...business, enrichmentAttempted: false }, attempted: false, foundPhone: false };
    const key = identityKey(business);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    const evidence: WebSearchEvidence[] = [];
    for (const searchQuery of this.queries(business)) {
      evidence.push(...await this.provider.search(searchQuery, { name: business.name, city: business.city, state: business.state, district: business.district, address: business.address }));
      if (evidence.some((item) => this.matches(business, item) && item.phone && normalizePhone(item.phone))) break;
    }
    const match = evidence.find((item) => this.matches(business, item) && item.phone && normalizePhone(item.phone));
    const result: EnrichmentResult = { business: { ...business, ...(match ? this.applyEvidence(business, match) : {}), enrichmentAttempted: true, enrichmentSource: this.provider.getProviderName() }, attempted: true, foundPhone: Boolean(match?.phone), source: match ? this.provider.getProviderName() : undefined };
    cache.set(key, { expiresAt: Date.now() + TTL, result });
    void query;
    return result;
  }
  private applyEvidence(business: DiscoveryBusiness, evidence: WebSearchEvidence): Partial<DiscoveryBusiness> {
    return { phone: evidence.phone, phoneSource: this.provider?.getProviderName(), phoneSourceUrl: evidence.phoneSourceUrl, phoneConfidence: evidence.confidence || 'CONFIRMED', phoneVerifiedAt: new Date().toISOString(), website: business.website || evidence.website, instagram: business.instagram || evidence.instagram, facebook: business.facebook || evidence.facebook, email: business.email || evidence.email };
  }
}
