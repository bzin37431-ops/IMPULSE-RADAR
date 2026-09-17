import { env } from '../../config.js';
import { DiscoveryProvider } from './DiscoveryProvider.js';
import { MockDiscoveryProvider } from './MockDiscoveryProvider.js';
import { OpenStreetMapProvider } from './OpenStreetMapProvider.js';
import { GooglePlacesProvider } from './GooglePlacesProvider.js';
import { WebSearchDiscoveryProvider } from './WebSearchDiscoveryProvider.js';
export function discoveryProviders(mode: 'PRINCIPAL'|'ALTERNATIVA'|'AMPLIADA'): DiscoveryProvider[] {
  if (env.DISCOVERY_TEST_MODE) return mode === 'AMPLIADA' ? [new MockDiscoveryProvider('MOCK_PRIMARY'), new MockDiscoveryProvider('MOCK_OSM'), new MockDiscoveryProvider('MOCK_WEB')] : [new MockDiscoveryProvider()];
  if (mode === 'PRINCIPAL') return env.GOOGLE_PLACES_API_KEY ? [new GooglePlacesProvider()] : [new OpenStreetMapProvider()];
  if (mode === 'ALTERNATIVA') return [new OpenStreetMapProvider(), new WebSearchDiscoveryProvider()];
  return [new GooglePlacesProvider(), new OpenStreetMapProvider(), new WebSearchDiscoveryProvider()];
}
export * from './DiscoveryProvider.js';
export * from './MockDiscoveryProvider.js';
