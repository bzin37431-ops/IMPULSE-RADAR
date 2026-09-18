import { env } from '../../config.js';
import { DiscoveryProvider } from './DiscoveryProvider.js';
import { MockDiscoveryProvider } from './MockDiscoveryProvider.js';
import { OpenStreetMapProvider } from './OpenStreetMapProvider.js';
import { GooglePlacesProvider } from './GooglePlacesProvider.js';
import { WebSearchDiscoveryProvider } from './WebSearchDiscoveryProvider.js';
import { GeoapifyProvider } from './GeoapifyProvider.js';
import { TavilyWebSearchProvider } from './TavilyWebSearchProvider.js';
export function discoveryProviders(mode: 'PRINCIPAL'|'ALTERNATIVA'|'AMPLIADA'): DiscoveryProvider[] {
  if (env.DISCOVERY_MODE === 'real' || !env.DISCOVERY_TEST_MODE) {
    return [new GeoapifyProvider(), ...(env.TAVILY_API_KEY ? [new TavilyWebSearchProvider()] : env.SEARCH_PROVIDER_API_KEY ? [new WebSearchDiscoveryProvider()] : [])];
  }
  const realProviderConfigured = Boolean(env.GEOAPIFY_API_KEY || env.GOOGLE_PLACES_API_KEY || env.SEARCH_PROVIDER_API_KEY || env.TAVILY_API_KEY);
  if (env.DISCOVERY_TEST_MODE && !realProviderConfigured) return mode === 'AMPLIADA' ? [new MockDiscoveryProvider('MOCK_PRIMARY'), new MockDiscoveryProvider('MOCK_OSM'), new MockDiscoveryProvider('MOCK_WEB')] : [new MockDiscoveryProvider()];
  if (mode === 'PRINCIPAL') return env.GEOAPIFY_API_KEY ? [new GeoapifyProvider()] : env.GOOGLE_PLACES_API_KEY ? [new GooglePlacesProvider()] : [new OpenStreetMapProvider()];
  if (mode === 'ALTERNATIVA') return [new OpenStreetMapProvider(), new WebSearchDiscoveryProvider()];
    return [env.GEOAPIFY_API_KEY ? new GeoapifyProvider() : new GooglePlacesProvider(), new OpenStreetMapProvider(), ...(env.TAVILY_API_KEY ? [new TavilyWebSearchProvider()] : env.SEARCH_PROVIDER_API_KEY ? [new WebSearchDiscoveryProvider()] : [])];
}
export * from './DiscoveryProvider.js';
export * from './MockDiscoveryProvider.js';
