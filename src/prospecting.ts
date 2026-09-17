import { DiscoveryBusiness } from './providers/discovery/index.js';
import { normalizePhone } from './domain.js';
export type DigitalStatus = 'UNKNOWN'|'NO_WEBSITE_FOUND'|'SOCIAL_ONLY'|'HAS_WEBSITE';
export function normalizeName(name: string) { return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function domainOf(website?: string) { try { return website ? new URL(website).hostname.replace(/^www\./, '') : undefined; } catch { return undefined; } }
export function classifyDigitalStatus(business: DiscoveryBusiness): { status: DigitalStatus; confidence: 'HIGH'|'MEDIUM'|'LOW' } {
  if (business.website) return { status: 'HAS_WEBSITE', confidence: 'HIGH' };
  if (business.instagram || business.facebook || business.tiktok || business.linkedin) return { status: 'SOCIAL_ONLY', confidence: 'MEDIUM' };
  return { status: 'NO_WEBSITE_FOUND', confidence: 'LOW' };
}
export function scoreOpportunity(business: DiscoveryBusiness) {
  const digital = classifyDigitalStatus(business); const breakdown: Record<string, number> = {}; let score = 0;
  const add = (label: string, value: number) => { breakdown[label] = value; score += value; };
  if (digital.status === 'NO_WEBSITE_FOUND') add('Nenhum site localizado', 30); else if (digital.status === 'SOCIAL_ONLY') add('Presença somente em rede social', 20);
  if (business.phone) add('Telefone disponível', 15); if (business.whatsapp) add('WhatsApp confirmado', 8); if (business.instagram || business.facebook) add('Rede social localizada', 10);
  if (business.address && business.city) add('Endereço confirmado', 10); if (business.rating && business.rating >= 4) add('Boa avaliação pública', 8); if ((business.reviewsCount || 0) >= 20) add('Volume de avaliações', 5);
  return { score: Math.min(100, score), breakdown, digitalStatus: digital.status, confidence: digital.confidence };
}
export function normalizeBusiness(business: DiscoveryBusiness) { const analysis = scoreOpportunity(business); return { ...business, normalizedName: normalizeName(business.name), normalizedPhone: normalizePhone(business.phone), domain: domainOf(business.website), ...analysis }; }
export function deduplicateBusinesses(items: ReturnType<typeof normalizeBusiness>[]) {
  const result: ReturnType<typeof normalizeBusiness>[] = [];
  for (const item of items) { const existing = result.find((candidate) => (item.normalizedPhone && candidate.normalizedPhone === item.normalizedPhone) || (item.domain && candidate.domain === item.domain) || candidate.normalizedName === item.normalizedName && candidate.city.toLowerCase() === item.city.toLowerCase() || item.latitude && candidate.latitude && Math.abs(candidate.latitude - item.latitude) < .0005 && Math.abs((candidate.longitude || 0) - (item.longitude || 0)) < .0005); if (!existing) result.push(item); else { existing.phone ||= item.phone; existing.website ||= item.website; existing.instagram ||= item.instagram; existing.rating = Math.max(existing.rating || 0, item.rating || 0); } }
  return result;
}
