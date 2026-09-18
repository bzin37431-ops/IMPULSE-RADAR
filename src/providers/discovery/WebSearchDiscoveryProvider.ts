import { env } from '../../config.js';
import { DiscoveryProvider, DiscoveryQuery } from './DiscoveryProvider.js';
export class WebSearchDiscoveryProvider implements DiscoveryProvider { getProviderName(){return 'WEB_SEARCH';} supportsLocation(){return Boolean(env.SEARCH_PROVIDER_API_KEY);} getRateLimitInfo(){return {configured:Boolean(env.SEARCH_PROVIDER_API_KEY),requestsPerMinute:30};} async searchBusinesses(_query:DiscoveryQuery){return [];} }
