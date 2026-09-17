import { DiscoveryBusiness, DiscoveryProvider, DiscoveryQuery } from './DiscoveryProvider.js';
const catalog = [
  ['Studio Nativa', 'Instagram',  -23.1896, -45.8841], ['Clínica Essenza', 'Instagram', -23.1932, -45.8878],
  ['Ateliê Aurora', 'website', -23.195, -45.891], ['Barbearia Norte', 'none', -23.181, -45.895],
  ['Odonto Vale', 'social', -23.201, -45.879], ['Casa Verde Arquitetura', 'website', -23.185, -45.902],
  ['Belle Estética', 'none', -23.197, -45.91], ['Movi Academia', 'social', -23.176, -45.87]
] as const;
export class MockDiscoveryProvider implements DiscoveryProvider {
  getProviderName() { return 'MOCK_DISCOVERY'; }
  supportsLocation() { return true; }
  getRateLimitInfo() { return { configured: true, requestsPerMinute: 120 }; }
  async searchBusinesses(query: DiscoveryQuery): Promise<DiscoveryBusiness[]> {
    return Array.from({ length: Math.min(query.quantity, 500) }, (_, index) => {
      const item = catalog[index % catalog.length]; const [name, kind, latitude, longitude] = item;
      const suffix = index >= catalog.length ? ` ${Math.floor(index / catalog.length) + 1}` : '';
      return { externalIds: { mock: `mock-${index}` }, name: `${name}${suffix}`, category: query.niche, city: query.city, state: query.state, district: query.district || (index % 2 ? 'Centro' : 'Jardim Aquarius'), latitude: latitude + (index % 7) * 0.0003, longitude: longitude + (index % 5) * 0.0003, phone: index % 3 === 0 ? `(12) 98888-${String(1000 + index).slice(-4)}` : undefined, instagram: kind === 'Instagram' || kind === 'social' ? `https://instagram.com/${name.toLowerCase().replaceAll(' ', '')}` : undefined, website: kind === 'website' ? `https://www.${name.toLowerCase().replaceAll(' ', '')}.com.br` : undefined, rating: 4.1 + (index % 8) / 10, reviewsCount: 12 + index * 3, address: `${100 + index} Avenida Principal` };
    });
  }
}
