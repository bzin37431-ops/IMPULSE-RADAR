import { env } from '../../config.js';
import { DiscoveryBusiness, DiscoveryProvider, DiscoveryQuery } from './DiscoveryProvider.js';
import { geoapifyCategories } from '../../nicheRelevance.js';

type GeoFeature = { type?: string; bbox?: number[]; geometry?: { type?: string; coordinates?: [number, number] }; properties?: Record<string, unknown> };
type GeoCollection = { features?: GeoFeature[] };
type Area = { placeId?: string; center: [number, number]; bbox?: [number, number, number, number]; city: string; state: string };
const API = 'https://api.geoapify.com';
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export function normalizeGeoapifyFeature(feature: GeoFeature, query: DiscoveryQuery): DiscoveryBusiness | undefined {
  const p = feature.properties || {};
  const coordinates = feature.geometry?.coordinates;
  const raw = (p.datasource as { raw?: Record<string, unknown> } | undefined)?.raw || {};
  const contact = (p.contact as Record<string, unknown> | undefined) || (raw.contact as Record<string, unknown> | undefined) || {};
  const phone = text(contact.phone) || text(p.phone) || text(raw.phone);
  const city = text(p.city) || text(p.town) || text(p.municipality);
  const state = text(p.state) || text(p.province);
  const name = text(p.name) || text(p.address_line1);
  if (!name || !city || !state || !coordinates || coordinates.length < 2) return undefined;
  return {
    externalIds: { geoapify: text(p.place_id) || text(p.datasource_id) || text(p.osm_id) || `${coordinates[0]},${coordinates[1]}` },
    name,
    category: (Array.isArray(p.categories) ? p.categories.filter((v): v is string => typeof v === 'string') : []).join(', ') || query.niche,
    phone,
    email: text(contact.email) || text(p.email) || text(raw.email),
    website: text(contact.website) || text(p.website) || text(raw.website),
    address: text(p.formatted) || text(p.address_line1) || text(p.address_line2),
    district: text(p.district) || text(p.suburb) || text(p.neighbourhood) || text(p.quarter),
    city,
    state,
    postalCode: text(p.postcode) || text(p.postal_code),
    latitude: number(coordinates[1]),
    longitude: number(coordinates[0]),
    mapsUrl: text(p.website) || undefined,
  };
}

export class GeoapifyProvider implements DiscoveryProvider {
  constructor(private readonly configuredKey = env.GEOAPIFY_API_KEY) {}
  getProviderName() { return 'GEOAPIFY'; }
  supportsLocation() { return Boolean(this.configuredKey); }
  getRateLimitInfo() { return { configured: Boolean(this.configuredKey), requestsPerMinute: 60 }; }
  async checkConnection() { if (!this.configuredKey) return false; try { await this.request<GeoCollection>('/v1/geocode/search', new URLSearchParams({ text: 'São Paulo, Brazil', format: 'json', limit: '1' })); return true; } catch { return false; } }
  private async request<T>(path: string, params: URLSearchParams): Promise<T> {
    if (!this.configuredKey) throw new Error('GEOAPIFY_API_KEY não configurada.');
    params.set('apiKey', this.configuredKey);
    const response = await fetch(`${API}${path}?${params}`, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Geoapify respondeu ${response.status}.`);
    return response.json() as Promise<T>;
  }
  private async resolveArea(query: DiscoveryQuery): Promise<Area> {
    const params = new URLSearchParams({ text: `${query.city}, ${query.state}, Brazil`, format: 'geojson', limit: '10', filter: 'countrycode:br', lang: 'pt' });
    const result = await this.request<GeoCollection>('/v1/geocode/search', params);
    const city = normalize(query.city);
    const state = normalize(query.state);
    const feature = (result.features || []).find((item) => {
      const p = item.properties || {};
      return normalize(text(p.city) || text(p.name) || '') === city && (!text(p.state) || normalize(text(p.state) || '') === state || normalize(text(p.state_code) || '') === normalize(query.state));
    }) || result.features?.[0];
    if (!feature) throw new Error(`Geoapify não encontrou a cidade ${query.city}, ${query.state}.`);
    const p = feature.properties || {};
    const coords = feature.geometry?.coordinates;
    const bbox = Array.isArray(feature.bbox) ? feature.bbox.map(Number) as [number, number, number, number] : Array.isArray(p.bbox) ? p.bbox.map(Number) as [number, number, number, number] : undefined;
    if (!coords || coords.length < 2) throw new Error('Geoapify retornou a cidade sem coordenadas.');
    return { placeId: text(p.place_id), center: [Number(coords[0]), Number(coords[1])], bbox, city: text(p.city) || query.city, state: text(p.state) || query.state };
  }
  private searchParams(categories: string[], area: Area, query: DiscoveryQuery, offset: number, filter?: string) {
    const params = new URLSearchParams({ categories: categories.join(','), limit: String(Math.min(20, Math.max(1, query.quantity))), offset: String(offset), bias: `proximity:${area.center[0]},${area.center[1]}`, lang: 'pt' });
    params.set('filter', filter || (area.placeId ? `place:${area.placeId}` : `circle:${area.center[0]},${area.center[1]},15000`));
    return params;
  }
  async searchBusinesses(query: DiscoveryQuery): Promise<DiscoveryBusiness[]> {
    const area = await this.resolveArea(query);
    const categories = geoapifyCategories(query.niche);
    const filters = [this.searchParams(categories, area, query, 0)];
    if (query.coverageMode !== 'STRICT' && area.bbox) {
      const [minLon, minLat, maxLon, maxLat] = area.bbox;
      const midLon = (minLon + maxLon) / 2, midLat = (minLat + maxLat) / 2;
      for (const rect of [[minLon, minLat, midLon, midLat], [midLon, minLat, maxLon, midLat], [minLon, midLat, midLon, maxLat], [midLon, midLat, maxLon, maxLat]]) {
        filters.push(this.searchParams(categories, area, query, 0, `rect:${rect.join(',')}`));
      }
    }
    const businesses: DiscoveryBusiness[] = [];
    for (const params of filters) {
      const data = await this.request<GeoCollection>('/v2/places', params);
      for (const feature of data.features || []) {
        const business = normalizeGeoapifyFeature(feature, query);
        if (business && normalize(business.city) === normalize(query.city) && normalize(business.state) === normalize(query.state)) businesses.push(business);
      }
      if (businesses.length >= query.quantity * 2) break;
    }
    return businesses;
  }
}
