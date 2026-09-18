export type DiscoveryBusiness = {
  externalIds?: Record<string, string>;
  name: string;
  category?: string;
  phone?: string;
  phoneSource?: string;
  phoneSourceUrl?: string;
  phoneConfidence?: string;
  phoneVerifiedAt?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  linkedin?: string;
  website?: string;
  mapsUrl?: string;
  address?: string;
  district?: string;
  city: string;
  state: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewsCount?: number;
  enrichmentAttempted?: boolean;
  enrichmentSource?: string;
};
export type DiscoveryQuery = { state: string; city: string; district?: string; niche: string; quantity: number; digitalStatus?: string; coverageMode?: string; searchId?: string };
export type ProviderRateLimit = { requestsPerMinute?: number; configured: boolean };
export interface DiscoveryProvider {
  searchBusinesses(query: DiscoveryQuery): Promise<DiscoveryBusiness[]>;
  getBusinessDetails?(id: string): Promise<DiscoveryBusiness | undefined>;
  supportsLocation(state: string, city: string): boolean;
  getProviderName(): string;
  getRateLimitInfo(): ProviderRateLimit;
}
