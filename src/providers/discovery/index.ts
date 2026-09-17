import { env } from '../../config.js';
import { DiscoveryProvider } from './DiscoveryProvider.js';
import { MockDiscoveryProvider } from './MockDiscoveryProvider.js';
import { OpenStreetMapProvider } from './OpenStreetMapProvider.js';
export function discoveryProviders(mode: 'PRINCIPAL'|'ALTERNATIVA'|'AMPLIADA'): DiscoveryProvider[] {
  if (env.DISCOVERY_TEST_MODE) return [new MockDiscoveryProvider()];
  if (mode === 'ALTERNATIVA') return [new OpenStreetMapProvider()];
  if (mode === 'AMPLIADA') return [new OpenStreetMapProvider()];
  return env.GOOGLE_PLACES_API_KEY ? [new OpenStreetMapProvider()] : [new OpenStreetMapProvider()];
}
export * from './DiscoveryProvider.js';
export * from './MockDiscoveryProvider.js';
