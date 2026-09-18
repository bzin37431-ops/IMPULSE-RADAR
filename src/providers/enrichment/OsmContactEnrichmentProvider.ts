import { env } from '../../config.js';
import { normalizePhone } from '../../domain.js';
import { DiscoveryBusiness, DiscoveryQuery } from '../discovery/DiscoveryProvider.js';
import { WebSearchEvidence } from '../discovery/WebSearchDiscoveryProvider.js';

type OsmRow = { display_name?: string; lat?: string; lon?: string; extratags?: { phone?: string; 'contact:phone'?: string; website?: string; email?: string } };
const normalize = (value?: string) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export class OsmContactEnrichmentProvider {
  getProviderName() { return 'OSM_CONTACT'; }
  isConfigured() { return env.OSM_CONTACT_ENRICHMENT_ENABLED; }
  async enrich(business: DiscoveryBusiness, _query: DiscoveryQuery): Promise<WebSearchEvidence[]> {
    if (!this.isConfigured()) return [];
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ q: `${business.name}, ${business.city}, ${business.state}`, format: 'jsonv2', addressdetails: '1', extratags: '1', limit: '5' }).toString();
    const response = await fetch(url, { headers: { 'user-agent': 'ImpulseProspect/1.0' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const rows = await response.json() as OsmRow[];
    return rows.filter((row) => normalize(row.display_name).includes(normalize(business.name)) && normalize(row.display_name).includes(normalize(business.city))).map((row) => ({ name: business.name, city: business.city, state: business.state, phone: normalizePhone(row.extratags?.phone || row.extratags?.['contact:phone']), phoneSourceUrl: row.display_name, website: row.extratags?.website, email: row.extratags?.email, confidence: 'HIGH', matchConfidence: 'HIGH' }));
  }
}
