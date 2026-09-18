import { DiscoveryBusiness } from "./providers/discovery/DiscoveryProvider.js";

export type DigitalStatus =
  | "UNKNOWN"
  | "NO_WEBSITE_FOUND"
  | "SOCIAL_ONLY"
  | "HAS_WEBSITE";

export class OpportunityScoringService {
  classifyDigitalStatus(
    business: DiscoveryBusiness,
  ): { status: DigitalStatus; confidence: "HIGH" | "MEDIUM" | "LOW" } {
    if (business.website) return { status: "HAS_WEBSITE", confidence: "HIGH" };
    if (business.instagram || business.facebook || business.tiktok || business.linkedin)
      return { status: "SOCIAL_ONLY", confidence: "MEDIUM" };
    return { status: "NO_WEBSITE_FOUND", confidence: "LOW" };
  }

  score(business: DiscoveryBusiness) {
    const digital = this.classifyDigitalStatus(business);
    const breakdown: Record<string, number> = {};
    let score = 0;
    const add = (label: string, value: number) => {
      breakdown[label] = value;
      score += value;
    };
    if (digital.status === "NO_WEBSITE_FOUND") add("Nenhum site localizado", 30);
    else if (digital.status === "SOCIAL_ONLY")
      add("Presença somente em rede social", 20);
    if (business.phone) add("Telefone disponível", 15);
    if (business.whatsapp) add("WhatsApp confirmado", 8);
    if (business.instagram || business.facebook)
      add("Rede social localizada", 10);
    if (business.address && business.city) add("Endereço confirmado", 10);
    if (business.rating && business.rating >= 4)
      add("Boa avaliação pública", 8);
    if ((business.reviewsCount || 0) >= 20)
      add("Volume de avaliações", 5);
    return {
      score: Math.min(100, score),
      breakdown,
      digitalStatus: digital.status,
      confidence: digital.confidence,
    };
  }
}

export const opportunityScoringService = new OpportunityScoringService();
