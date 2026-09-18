import { DiscoveryBusiness } from './providers/discovery/index.js';
import { normalizePhone } from './domain.js';
import { opportunityScoringService } from './opportunityScoringService.js';
export type { DigitalStatus } from './opportunityScoringService.js';
export function normalizeName(name: string) { return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function domainOf(website?: string) { try { return website ? new URL(website).hostname.replace(/^www\./, '') : undefined; } catch { return undefined; } }
export const classifyDigitalStatus = (business: DiscoveryBusiness) => opportunityScoringService.classifyDigitalStatus(business);
export const scoreOpportunity = (business: DiscoveryBusiness) => opportunityScoringService.score(business);
export function normalizeBusiness(business: DiscoveryBusiness) { const analysis = scoreOpportunity(business); return { ...business, normalizedName: normalizeName(business.name), normalizedPhone: normalizePhone(business.phone), domain: domainOf(business.website), ...analysis }; }
export function deduplicateBusinesses(items: ReturnType<typeof normalizeBusiness>[]) {
  const result: ReturnType<typeof normalizeBusiness>[] = [];
  for (const item of items) { const existing = result.find((candidate) => (item.normalizedPhone && candidate.normalizedPhone === item.normalizedPhone) || (item.domain && candidate.domain === item.domain) || candidate.normalizedName === item.normalizedName && candidate.city.toLowerCase() === item.city.toLowerCase() || item.latitude && candidate.latitude && Math.abs(candidate.latitude - item.latitude) < .0005 && Math.abs((candidate.longitude || 0) - (item.longitude || 0)) < .0005); if (!existing) result.push(item); else { existing.phone ||= item.phone; existing.website ||= item.website; existing.instagram ||= item.instagram; existing.rating = Math.max(existing.rating || 0, item.rating || 0); } }
  return result;
}
