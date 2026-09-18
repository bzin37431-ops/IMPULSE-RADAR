import crypto from "node:crypto";
import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  MemoryStore,
  ProspectBusiness,
  ProspectSearch,
  SavedLayout,
} from "./store.js";
import { discoveryProviders } from "./providers/discovery/index.js";
import { deduplicateBusinesses, normalizeBusiness } from "./prospecting.js";
import { ProspectingQueue } from "./prospectingQueue.js";
import { LocationService } from "./locationService.js";
import { BUSINESS_NICHES } from "./data/businessNiches.js";
import { isNicheRelevant } from "./nicheRelevance.js";

const locationService = new LocationService();
const isDemoSearch = (search: ProspectSearch) =>
  discoveryProviders(
    search.sourceMode as "PRINCIPAL" | "ALTERNATIVA" | "AMPLIADA",
  ).every((provider) => provider.getProviderName().startsWith("MOCK"));
function assertCan(request: FastifyRequest) {
  if (request.headers["x-user-role"] === "VIEWER")
    throw Object.assign(new Error("Permissão insuficiente."), {
      statusCode: 403,
    });
}
function toBusiness(
  searchId: string,
  item: ReturnType<typeof normalizeBusiness>,
): ProspectBusiness {
  return {
    id: crypto.randomUUID(),
    searchId,
    externalIds: item.externalIds,
    name: item.name,
    normalizedName: item.normalizedName,
    category: item.category,
    phone: item.phone,
    normalizedPhone: item.normalizedPhone,
    whatsapp: item.whatsapp,
    email: item.email,
    instagram: item.instagram,
    facebook: item.facebook,
    tiktok: item.tiktok,
    linkedin: item.linkedin,
    website: item.website,
    domain: item.domain,
    mapsUrl: item.mapsUrl,
    address: item.address,
    district: item.district,
    city: item.city,
    state: item.state,
    postalCode: item.postalCode,
    latitude: item.latitude,
    longitude: item.longitude,
    rating: item.rating,
    reviewsCount: item.reviewsCount,
    digitalStatus: item.digitalStatus,
    digitalStatusConfidence: item.confidence,
    opportunityScore: item.score,
    scoreBreakdown: item.breakdown,
    sourceProviders: item.externalIds ? Object.keys(item.externalIds) : [],
    favorite: false,
    discarded: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
  };
}
export function registerProspectingRoutes(
  app: FastifyInstance,
  store: MemoryStore,
  prospectingQueue: ProspectingQueue,
) {
  app.get("/api/prospecting/localities", async (request) => {
    const uf = (request.query as { state?: string }).state;
    return {
      states: await locationService.states(),
      cities: uf ? await locationService.cities(uf) : [],
      districts: [],
    };
  });
  app.get("/api/prospecting/districts", async (request) => {
    const query = request.query as { state?: string; city?: string };
    if (!query.state || !query.city) return { data: [] };
    return {
      data: [
        "Toda a cidade",
        ...(await locationService.districts(query.city, query.state)),
      ],
    };
  });
  app.get("/api/prospecting/niches", async () => ({ data: BUSINESS_NICHES }));
  app.get("/api/prospecting/overview", async () => {
    const businesses = store.prospectBusinesses.filter(
      (item) => !item.sourceProviders?.includes("mock"),
    );
    const byState = Array.from(
      new Set(businesses.map((item) => item.state)),
    ).map((state) => {
      const items = businesses.filter((item) => item.state === state);
      return {
        state,
        total: items.length,
        noWebsite: items.filter(
          (item) => item.digitalStatus === "NO_WEBSITE_FOUND",
        ).length,
        socialOnly: items.filter((item) => item.digitalStatus === "SOCIAL_ONLY")
          .length,
        website: items.filter((item) => item.digitalStatus === "HAS_WEBSITE")
          .length,
        averageScore: items.length
          ? Math.round(
              items.reduce((sum, item) => sum + item.opportunityScore, 0) /
                items.length,
            )
          : 0,
      };
    });
    return {
      total: businesses.length,
      saved: store.savedLayouts.filter((layout) =>
        businesses.some((item) => item.id === layout.prospectBusinessId),
      ).length,
      commercial: Object.fromEntries(
        [
          "NOVO",
          "PARA_ABORDAR",
          "ABORDADO",
          "AGUARDANDO_RESPOSTA",
          "INTERESSADO",
          "PROPOSTA",
          "FECHADO",
          "DESCARTADO",
        ].map((status) => [
          status,
          store.savedLayouts.filter(
            (layout) =>
              layout.commercialStatus === status &&
              businesses.some((item) => item.id === layout.prospectBusinessId),
          ).length,
        ]),
      ),
      noWebsite: businesses.filter(
        (item) => item.digitalStatus === "NO_WEBSITE_FOUND",
      ).length,
      socialOnly: businesses.filter(
        (item) => item.digitalStatus === "SOCIAL_ONLY",
      ).length,
      website: businesses.filter((item) => item.digitalStatus === "HAS_WEBSITE")
        .length,
      averageScore: businesses.length
        ? Math.round(
            businesses.reduce((sum, item) => sum + item.opportunityScore, 0) /
              businesses.length,
          )
        : 0,
      byState,
      recentSearches: store.prospectingSearches
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
    };
  });
  app.get("/api/prospecting/saved-layouts", async () => ({
    data: store.savedLayouts
      .map((layout) => ({
        ...layout,
        business: store.prospectBusinesses.find(
          (item) => item.id === layout.prospectBusinessId,
        ),
      }))
      .filter((item) => item.business && !item.business.discarded),
  }));
  app.post("/api/prospecting/businesses/:id/save-layout", async (request) => {
    assertCan(request);
    const item = store.prospectBusinesses.find(
      (value) => value.id === (request.params as { id: string }).id,
    );
    if (!item)
      throw Object.assign(new Error("Oportunidade não encontrada."), {
        statusCode: 404,
      });
    const existing = store.savedLayouts.find(
      (layout) => layout.prospectBusinessId === item.id,
    );
    if (existing) return { data: existing, alreadySaved: true };
    const now = new Date().toISOString();
    const layout: SavedLayout = {
      id: crypto.randomUUID(),
      prospectBusinessId: item.id,
      searchId: item.searchId,
      savedAt: now,
      savedBy: String(request.headers["x-user-id"] || "anonymous"),
      commercialStatus: "NOVO",
      createdAt: now,
      updatedAt: now,
    };
    store.persistSavedLayout(layout);
    return { data: layout };
  });
  app.patch("/api/prospecting/saved-layouts/:id", async (request) => {
    assertCan(request);
    const layout = store.savedLayouts.find(
      (item) => item.id === (request.params as { id: string }).id,
    );
    if (!layout)
      throw Object.assign(new Error("Layout salvo não encontrado."), {
        statusCode: 404,
      });
    const body = z
      .object({
        commercialStatus: z
          .enum([
            "NOVO",
            "PARA_ABORDAR",
            "ABORDADO",
            "AGUARDANDO_RESPOSTA",
            "INTERESSADO",
            "PROPOSTA",
            "FECHADO",
            "DESCARTADO",
          ])
          .optional(),
        notes: z.string().max(5000).optional(),
      })
      .parse(request.body);
    Object.assign(layout, body, { updatedAt: new Date().toISOString() });
    store.persistSavedLayout(layout);
    return { data: layout };
  });
  app.delete("/api/prospecting/saved-layouts/:id", async (request) => {
    assertCan(request);
    const id = (request.params as { id: string }).id;
    if (!store.deleteSavedLayout(id))
      throw Object.assign(new Error("Layout salvo não encontrado."), {
        statusCode: 404,
      });
    return { ok: true };
  });
  app.get("/api/prospecting/businesses", async () => ({
    data: store.prospectBusinesses.filter((item) => !item.discarded),
  }));
  app.get("/api/prospecting/searches", async (request) => {
    assertCan(request);
    return {
      data: store.prospectingSearches
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  });
  app.get("/api/prospecting/searches/:id", async (request) => {
    assertCan(request);
    const id = (request.params as { id: string }).id;
    const search = store.prospectingSearches.find((item) => item.id === id);
    if (!search)
      throw Object.assign(new Error("Busca não encontrada."), {
        statusCode: 404,
      });
    return {
      search: { ...search, isDemo: isDemoSearch(search) },
      data: store.prospectBusinesses.filter(
        (item) => item.searchId === id && !item.discarded,
      ),
    };
  });
  app.delete("/api/prospecting/searches/:id", async (request) => {
    assertCan(request);
    const id = (request.params as { id: string }).id;
    if (!store.deleteProspectSearch(id))
      throw Object.assign(new Error("Busca não encontrada."), {
        statusCode: 404,
      });
    return { ok: true };
  });
  app.post("/api/prospecting/searches", async (request) => {
    assertCan(request);
    const body = z
      .object({
        state: z.string().min(2),
        city: z.string().min(2),
        district: z.string().optional(),
        niche: z.string().min(2),
        level: z.enum(["FRACO", "MEDIO", "ALTO", "ULTRA"]).default("ALTO"),
        sourceMode: z.enum(["PRINCIPAL", "ALTERNATIVA", "AMPLIADA"]).optional(),
        digitalStatus: z
          .enum(["UNKNOWN", "NO_WEBSITE_FOUND", "SOCIAL_ONLY", "HAS_WEBSITE"])
          .default("UNKNOWN"),
        minScore: z.coerce.number().int().min(0).max(100).default(0),
        quantity: z.coerce
          .number()
          .int()
          .refine(
            (value) =>
              [5, 10, 20, 30, 50, 100, 150, 200, 300, 400, 500].includes(value),
            "Quantidade inválida.",
          ),
        coverageMode: z
          .enum(["STRICT", "INTELLIGENT", "BROAD"])
          .default("INTELLIGENT"),
        idempotencyKey: z.string().min(8).max(128).optional(),
      })
      .parse(request.body);
    const userId = String(request.headers["x-user-id"] || "anonymous");
    const idempotencyKey =
      body.idempotencyKey ||
      (typeof request.headers["idempotency-key"] === "string"
        ? request.headers["idempotency-key"]
        : undefined);
    if (idempotencyKey) {
      const existing = store.prospectingSearches.find(
        (item) =>
          item.userId === userId && item.idempotencyKey === idempotencyKey,
      );
      if (existing)
        return {
          data: { ...existing, isDemo: isDemoSearch(existing) },
          idempotent: true,
        };
    }
    const sourceMode =
      body.sourceMode ||
      (
        {
          FRACO: "PRINCIPAL",
          MEDIO: "ALTERNATIVA",
          ALTO: "AMPLIADA",
          ULTRA: "AMPLIADA",
        } as const
      )[body.level];
    const search: ProspectSearch = {
      id: crypto.randomUUID(),
      ...body,
      sourceMode,
      userId,
      idempotencyKey,
      status: "QUEUED",
      progress: 0,
      providersConsulted: 0,
      uniqueResults: 0,
      noWebsiteCount: 0,
      socialOnlyCount: 0,
      websiteCount: 0,
      createdAt: new Date().toISOString(),
      resultsCount: 0,
      lastHeartbeatAt: undefined,
    };
    store.persistProspectSearch(search);
    await prospectingQueue.enqueue(search);
    return {
      data: { ...search, level: body.level, isDemo: isDemoSearch(search) },
    };
  });
  app.post("/api/prospecting/searches/:id/cancel", async (request) => {
    assertCan(request);
    const search = store.prospectingSearches.find(
      (item) => item.id === (request.params as { id: string }).id,
    );
    if (!search)
      throw Object.assign(new Error("Busca não encontrada."), {
        statusCode: 404,
      });
    if (
      ["COMPLETED", "FAILED", "CANCELLED", "INTERRUPTED"].includes(
        search.status,
      )
    )
      return { data: search };
    search.status = "CANCELLED";
    search.cancelledAt = new Date().toISOString();
    store.persistProspectSearch(search);
    return { data: search };
  });
  app.post("/api/prospecting/searches/:id/retry", async (request) => {
    assertCan(request);
    const original = store.prospectingSearches.find(
      (item) => item.id === (request.params as { id: string }).id,
    );
    if (!original)
      throw Object.assign(new Error("Busca não encontrada."), {
        statusCode: 404,
      });
    if (!["FAILED", "INTERRUPTED"].includes(original.status))
      return { data: original, retried: false };
    const retry: ProspectSearch = {
      ...original,
      id: crypto.randomUUID(),
      status: "QUEUED",
      progress: 0,
      providersConsulted: 0,
      uniqueResults: 0,
      noWebsiteCount: 0,
      socialOnlyCount: 0,
      websiteCount: 0,
      resultsCount: 0,
      createdAt: new Date().toISOString(),
      startedAt: undefined,
      lastHeartbeatAt: undefined,
      completedAt: undefined,
      cancelledAt: undefined,
      errorMessage: undefined,
      idempotencyKey: undefined,
    };
    store.persistProspectSearch(retry);
    await prospectingQueue.enqueue(retry);
    return { data: retry, retried: true };
  });
  app.patch("/api/prospecting/businesses/:id", async (request) => {
    assertCan(request);
    const item = store.prospectBusinesses.find(
      (value) => value.id === (request.params as { id: string }).id,
    );
    if (!item)
      throw Object.assign(new Error("Oportunidade não encontrada."), {
        statusCode: 404,
      });
    const body = z
      .object({
        favorite: z.boolean().optional(),
        discarded: z.boolean().optional(),
        discardReason: z.string().optional(),
      })
      .parse(request.body);
    Object.assign(item, body, { updatedAt: new Date().toISOString() });
    store.persistProspectBusiness(item);
    return { data: item };
  });
  app.post("/api/prospecting/businesses/bulk", async (request) => {
    assertCan(request);
    const body = z
      .object({
        ids: z.array(z.string()).min(1).max(500),
        action: z.enum(["SAVE", "DISCARD"]),
        discardReason: z.string().max(500).optional(),
      })
      .parse(request.body);
    const businesses = body.ids
      .map((id) => store.prospectBusinesses.find((item) => item.id === id))
      .filter((item): item is ProspectBusiness => Boolean(item));
    let saved = 0;
    let alreadySaved = 0;
    let discarded = 0;
    for (const item of businesses) {
      if (body.action === "DISCARD") {
        item.discarded = true;
        item.discardReason = body.discardReason;
        item.updatedAt = new Date().toISOString();
        store.persistProspectBusiness(item);
        discarded += 1;
        continue;
      }
      if (store.savedLayouts.some((layout) => layout.prospectBusinessId === item.id)) {
        alreadySaved += 1;
        continue;
      }
      const now = new Date().toISOString();
      store.persistSavedLayout({
        id: crypto.randomUUID(),
        prospectBusinessId: item.id,
        searchId: item.searchId,
        savedAt: now,
        savedBy: String(request.headers["x-user-id"] || "anonymous"),
        commercialStatus: "NOVO",
        createdAt: now,
        updatedAt: now,
      });
      saved += 1;
    }
    return { data: { requested: body.ids.length, matched: businesses.length, saved, alreadySaved, discarded } };
  });
  app.post("/api/prospecting/businesses/:id/reverify", async (request) => {
    assertCan(request);
    const item = store.prospectBusinesses.find(
      (value) => value.id === (request.params as { id: string }).id,
    );
    if (!item)
      throw Object.assign(new Error("Oportunidade não encontrada."), {
        statusCode: 404,
      });
    item.verifiedAt = new Date().toISOString();
    item.updatedAt = item.verifiedAt;
    store.persistProspectBusiness(item);
    return { data: item, providerChecked: false };
  });
  app.post("/api/prospecting/businesses/:id/save-lead", async (request) => {
    assertCan(request);
    const item = store.prospectBusinesses.find(
      (value) => value.id === (request.params as { id: string }).id,
    );
    if (!item)
      throw Object.assign(new Error("Oportunidade não encontrada."), {
        statusCode: 404,
      });
    const result = store.createLead({
      name: item.name,
      company: item.name,
      phone: item.phone,
      normalizedPhone: item.normalizedPhone,
      instagram: item.instagram,
      site: item.website,
      googleMaps: item.mapsUrl,
      city: item.city,
      state: item.state,
      niche: item.category,
      source: `PROSPECTING:${item.searchId}`,
      observations: `Score de oportunidade: ${item.opportunityScore}. Status digital: ${item.digitalStatus}.`,
    });
    if (result.lead) {
      item.sourceProviders = Array.from(
        new Set([...(item.sourceProviders || []), "SAVED"]),
      );
      store.persistProspectBusiness(item);
      store.addHistory(
        result.lead.id,
        "SAVED_AS_LEAD",
        `PROSPECT_BUSINESS:${item.id}`,
      );
    }
    return result.duplicate
      ? { duplicate: result.duplicate }
      : { data: result.lead };
  });
  app.get("/api/prospecting/searches/:id/export", async (request, reply) => {
    assertCan(request);
    const id = (request.params as { id: string }).id;
    const rows = store.prospectBusinesses.filter(
      (item) => item.searchId === id && !item.discarded,
    );
    reply.type("text/csv");
    return [
      "Empresa,Telefone,WhatsApp,Instagram,Site,Maps,Cidade,Bairro,Nicho,Score,Status digital",
      ...rows.map((item) =>
        [
          item.name,
          item.phone,
          item.whatsapp,
          item.instagram,
          item.website,
          item.mapsUrl,
          item.city,
          item.district,
          item.category,
          item.opportunityScore,
          item.digitalStatus,
        ]
          .map((value) => `"${String(value || "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
  });
}
export async function runSearch(search: ProspectSearch, store: MemoryStore) {
  try {
    search.status = "RUNNING";
    search.startedAt = new Date().toISOString();
    search.lastHeartbeatAt = search.startedAt;
    store.persistProspectSearch(search);
    const providers = discoveryProviders(
      search.sourceMode as "PRINCIPAL" | "ALTERNATIVA" | "AMPLIADA",
    );
    search.providersConsulted = providers.length;
    const demo = providers.every((provider) =>
      provider.getProviderName().startsWith("MOCK"),
    );
    const raw = [];
    for (const provider of providers) {
      if (search.status === "CANCELLED") return;
      search.lastHeartbeatAt = new Date().toISOString();
      raw.push(
        ...(await provider.searchBusinesses({
          state: search.state,
          city: search.city,
          district: search.district,
          niche: search.niche,
          quantity: search.quantity,
          digitalStatus: search.digitalStatus,
        })),
      );
      search.progress = Math.min(
        80,
        Math.round(
          (raw.length / Math.max(1, search.quantity * providers.length)) * 80,
        ),
      );
      store.persistProspectSearch(search);
    }
    const normalized = deduplicateBusinesses(raw.map(normalizeBusiness))
      .filter(
        (item) =>
          item.city.trim().toLocaleLowerCase("pt-BR") ===
          search.city.trim().toLocaleLowerCase("pt-BR"),
      )
      .filter(
        (item) =>
          item.state.trim().toUpperCase() === search.state.trim().toUpperCase(),
      )
      .filter((item) => isNicheRelevant(item.name, item.category, search.niche))
      .filter((item) => demo || Boolean(item.normalizedPhone))
      .filter(
        (item) =>
          !store.prospectBusinesses.some(
            (existing) =>
              existing.discarded &&
              ((item.normalizedPhone &&
                existing.normalizedPhone === item.normalizedPhone) ||
                (existing.normalizedName === item.normalizedName &&
                  existing.city.toLocaleLowerCase("pt-BR") ===
                    item.city.toLocaleLowerCase("pt-BR") &&
                  existing.state.toUpperCase() === item.state.toUpperCase())),
          ),
      )
      .filter((item) => item.score >= search.minScore)
      .filter(
        (item) =>
          search.digitalStatus === "UNKNOWN" ||
          item.digitalStatus === search.digitalStatus,
      )
      .slice(0, search.quantity);
    for (const item of normalized) {
      if (search.status === "CANCELLED") return;
      const business = toBusiness(search.id, item);
      store.persistProspectBusiness(business);
    }
    search.progress =
      normalized.length >= search.quantity
        ? 100
        : Math.min(
            99,
            Math.round(
              (normalized.length / Math.max(1, search.quantity)) * 100,
            ),
          );
    search.status = "COMPLETED";
    search.completedAt = new Date().toISOString();
    search.resultsCount = normalized.length;
    search.uniqueResults = normalized.length;
    search.noWebsiteCount = normalized.filter(
      (item) => item.digitalStatus === "NO_WEBSITE_FOUND",
    ).length;
    search.socialOnlyCount = normalized.filter(
      (item) => item.digitalStatus === "SOCIAL_ONLY",
    ).length;
    search.websiteCount = normalized.filter(
      (item) => item.digitalStatus === "HAS_WEBSITE",
    ).length;
    if (!demo && !providers.length)
      search.errorMessage = "Provider real não configurado.";
    else if (!demo && !normalized.length)
      search.errorMessage =
        "Nenhuma empresa válida com telefone foi encontrada.";
    store.persistProspectSearch(search);
  } catch (error) {
    search.status = "FAILED";
    search.errorMessage =
      error instanceof Error ? error.message : "Falha na busca.";
    store.persistProspectSearch(search);
  }
}
