import { env } from '../../config.js';
import { DiscoveryBusiness, DiscoveryProvider, DiscoveryQuery } from './DiscoveryProvider.js';
import { normalizePhone } from '../../domain.js';
import { WebSearchContext, WebSearchEvidence, WebSearchProvider } from './WebSearchDiscoveryProvider.js';

type TavilyResult = { title?: string; url?: string; content?: string; raw_content?: string | null };
type TavilyResponse = { results?: TavilyResult[] };
export type TavilyStatus = 'ACTIVE' | 'NOT_CONFIGURED' | 'ERROR' | 'RATE_LIMITED' | 'QUOTA_EXHAUSTED';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const phonePattern = /(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]*\d{4}/g;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;

export class TavilyWebSearchProvider implements DiscoveryProvider, WebSearchProvider {
  private requestCount = 0;
  private status: TavilyStatus = env.TAVILY_API_KEY ? 'ACTIVE' : 'NOT_CONFIGURED';
  constructor(private readonly configuredKey = env.TAVILY_API_KEY) {}
  getProviderName() { return 'TAVILY_WEB_SEARCH'; }
  supportsLocation() { return Boolean(this.configuredKey); }
  isConfigured() { return Boolean(this.configuredKey) && this.status !== 'QUOTA_EXHAUSTED'; }
  getRateLimitInfo() { return { configured: Boolean(this.configuredKey), requestsPerMinute: 20 }; }
  getRequestCount() { return this.requestCount; }
  getStatus() { return this.status; }
  async searchBusinesses(_query: DiscoveryQuery): Promise<DiscoveryBusiness[]> { return []; }

  async search(query: string, context?: WebSearchContext): Promise<WebSearchEvidence[]> {
    if (!this.configuredKey || this.status === 'QUOTA_EXHAUSTED' || this.status === 'RATE_LIMITED') return [];
    this.requestCount += 1;
    let response: Response;
    try {
      response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: this.configuredKey, query, topic: 'general', search_depth: 'basic', max_results: 5, include_answer: false, include_raw_content: false }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      this.status = 'ERROR';
      return [];
    }
    if (response.status === 429) { this.status = 'RATE_LIMITED'; return []; }
    if (response.status === 402) { this.status = 'QUOTA_EXHAUSTED'; return []; }
    if (response.status === 401 || response.status === 403 || !response.ok) { this.status = 'ERROR'; return []; }
    try {
      const payload = await response.json() as TavilyResponse;
      this.status = 'ACTIVE';
      return (payload.results || []).flatMap((result) => this.toEvidence(result, context));
    } catch {
      this.status = 'ERROR';
      return [];
    }
  }

  private toEvidence(result: TavilyResult, context?: WebSearchContext): WebSearchEvidence[] {
    if (!context) return [];
    const sourceText = `${result.title || ''} ${result.content || ''} ${result.raw_content || ''} ${result.url || ''}`;
    const normalizedText = normalize(sourceText);
    const normalizedTitle = normalize(result.title || '');
    const nameSignal = normalize(context.name);
    const citySignal = normalize(context.city);
    if (!nameSignal || !normalizedText.includes(nameSignal) || !normalizedText.includes(citySignal)) return [];
    const addressSignal = context.address ? normalize(context.address).slice(0, 12) : '';
    const districtSignal = context.district ? normalize(context.district) : '';
    const nameCore = nameSignal.endsWith('s') ? nameSignal.slice(0, -1) : nameSignal;
    const domainSignal = result.url ? normalize(result.url.split('/')[2] || '').includes(nameCore.slice(0, Math.max(6, nameCore.length))) : false;
    const titleSignal = normalizedTitle.includes(nameSignal) || normalizedTitle.includes(nameCore);
    const addressSignalConfirmed = Boolean(addressSignal && normalizedText.includes(addressSignal));
    const districtSignalConfirmed = Boolean(districtSignal && normalizedText.includes(districtSignal));
    if (!domainSignal && !(titleSignal && (addressSignalConfirmed || districtSignalConfirmed))) return [];
    const phone = [...sourceText.matchAll(phonePattern)].map((match) => normalizePhone(match[0])).find(Boolean);
    const url = result.url && /^https?:\/\//i.test(result.url) ? result.url : undefined;
    const website = url && !/instagram\.com|facebook\.com/i.test(url) ? url : undefined;
    const instagram = url && /instagram\.com/i.test(url) ? url : undefined;
    const facebook = url && /facebook\.com/i.test(url) ? url : undefined;
    const email = sourceText.match(emailPattern)?.[0];
    return [{ name: context.name, city: context.city, state: context.state, district: districtSignalConfirmed ? context.district : undefined, address: addressSignalConfirmed ? context.address : undefined, website, instagram, facebook, email, phone, phoneSourceUrl: phone ? url : undefined, confidence: phone ? 'CONFIRMED' : undefined }];
  }
}
