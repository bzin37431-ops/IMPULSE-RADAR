import { DiscoveryBusiness, DiscoveryProvider, DiscoveryQuery } from './DiscoveryProvider.js';
export class OpenStreetMapProvider implements DiscoveryProvider {
  getProviderName() { return 'OPENSTREETMAP'; }
  supportsLocation() { return true; }
  getRateLimitInfo() { return { configured: true, requestsPerMinute: 60 }; }
  async searchBusinesses(query: DiscoveryQuery): Promise<DiscoveryBusiness[]> {
    const params = new URLSearchParams({ q: `${query.niche}, ${query.city}, ${query.state}, Brasil`, format: 'jsonv2', addressdetails: '1', limit: String(Math.min(query.quantity, 50)) });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': 'ImpulseProspect/1.0 (local CRM)' } });
    if (!response.ok) throw new Error(`OpenStreetMap respondeu ${response.status}.`);
    const rows = await response.json() as Array<{ place_id: number; display_name: string; lat: string; lon: string; type?: string; address?: Record<string, string> }>;
    return rows.map((row) => ({ externalIds: { osm: String(row.place_id) }, name: row.display_name.split(',')[0], category: query.niche, city: query.city, state: query.state, district: row.address?.suburb || row.address?.neighbourhood, address: row.display_name, latitude: Number(row.lat), longitude: Number(row.lon) }));
  }
}
