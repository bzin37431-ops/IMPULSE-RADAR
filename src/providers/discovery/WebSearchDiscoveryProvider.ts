import { env } from '../../config.js';
import { DiscoveryBusiness, DiscoveryProvider, DiscoveryQuery } from './DiscoveryProvider.js';

export type WebSearchEvidence = { name: string; city: string; state: string; district?: string; address?: string; website?: string; phone?: string; phoneSourceUrl?: string; confidence?: string };
export interface WebSearchProvider {
  getProviderName(): string;
  isConfigured(): boolean;
  search(query: string): Promise<WebSearchEvidence[]>;
}

export class WebSearchDiscoveryProvider implements DiscoveryProvider, WebSearchProvider {
  getProviderName(){return 'WEB_SEARCH';}
  supportsLocation(){return Boolean(env.SEARCH_PROVIDER_API_KEY);}
  isConfigured(){return Boolean(env.SEARCH_PROVIDER_API_KEY);}
  getRateLimitInfo(){return {configured:Boolean(env.SEARCH_PROVIDER_API_KEY),requestsPerMinute:30};}
  async searchBusinesses(_query:DiscoveryQuery): Promise<DiscoveryBusiness[]>{return [];}
  async search(_query: string): Promise<WebSearchEvidence[]> { return []; }
}
