import assert from "node:assert/strict";
import test from "node:test";
import { GeoapifyProvider, normalizeGeoapifyFeature } from "../src/providers/discovery/GeoapifyProvider.js";
import { geoapifyCategories } from "../src/nicheRelevance.js";
import { assessNicheRelevance } from "../src/nicheRelevance.js";
import { ProspectEnrichmentService } from "../src/prospectEnrichmentService.js";
import { TavilyWebSearchProvider } from "../src/providers/discovery/TavilyWebSearchProvider.js";
import { evaluateReceitaMatch } from "../src/providers/enrichment/ReceitaCnpjEnrichmentProvider.js";
import { normalizeCnpj } from "../src/receitaCnpjIndex.js";
import { normalizeReceiptPhone, parseOfficialEstablishment } from "../src/receitaCnpjImporter.js";

const query = { state: "São Paulo", city: "Jacareí", niche: "Restaurante japonês", quantity: 20, coverageMode: "STRICT" } as const;

test("normaliza CNPJ antigo, alfanumérico e zeros sem coerção numérica", () => {
  assert.equal(normalizeCnpj("00.000.000/0001-91"), "00000000000191");
  assert.equal(normalizeCnpj("AB.001/0001-9Z"), "AB00100019Z");
  assert.equal(normalizeCnpj("00012345678900"), "00012345678900");
});

test("interpreta layout oficial de estabelecimento, município, UF, situação e telefones", () => {
  const row = Array.from({ length: 30 }, () => "");
  row[0] = "00000001"; row[1] = "0001"; row[2] = "91"; row[3] = "1"; row[4] = "SUSHI JACAREI"; row[5] = "02";
  row[11] = "5611201"; row[12] = "5611203"; row[13] = "Rua"; row[14] = "das Flores"; row[15] = "10"; row[16] = "Sala 2"; row[17] = "Centro"; row[18] = "12300-000"; row[19] = "SP"; row[20] = "6451"; row[21] = "12"; row[22] = "39551234"; row[23] = "12"; row[24] = "99999999"; row[27] = "contato@sushi.example";
  const parsed = parseOfficialEstablishment(row, "Jacareí", "SUSHI JACAREI LTDA");
  assert.equal(parsed?.cnpj, "00000001000191");
  assert.equal(parsed?.city, "Jacareí"); assert.equal(parsed?.state, "SP"); assert.equal(parsed?.status, "ATIVA");
  assert.equal(parsed?.phone1, "1239551234"); assert.equal(parsed?.phone2, null); assert.equal(parsed?.cnaeSecondary, "5611203");
  assert.equal(parsed?.complement, "Sala 2");
});

test("descarta telefone vazio, placeholder ou obviamente inválido", () => {
  assert.equal(normalizeReceiptPhone("", ""), null);
  assert.equal(normalizeReceiptPhone("11", "00000000"), null);
  assert.equal(normalizeReceiptPhone("11", "12345678"), "1112345678");
});

test("normaliza feature Geoapify com endereço, telefone, categoria e coordenadas reais", () => {
  const business = normalizeGeoapifyFeature({
    bbox: [-46.0, -23.3, -45.9, -23.2],
    geometry: { type: "Point", coordinates: [-45.965, -23.305] },
    properties: {
      place_id: "geo-place-1",
      name: "Sushi Jacareí",
      categories: ["catering.restaurant.japanese", "catering.restaurant.sushi"],
      formatted: "Rua das Flores, 10, Jacareí, São Paulo, 12300-000, Brasil",
      address_line1: "Rua das Flores, 10",
      suburb: "Centro",
      city: "Jacareí",
      state: "São Paulo",
      postcode: "12300-000",
      contact: { phone: "+55 12 3951-0000", website: "https://sushi.example", email: "contato@sushi.example" },
    },
  }, query);
  assert.equal(business?.name, "Sushi Jacareí");
  assert.equal(business?.city, "Jacareí");
  assert.equal(business?.district, "Centro");
  assert.equal(business?.postalCode, "12300-000");
  assert.equal(business?.phone, "+55 12 3951-0000");
  assert.deepEqual([business?.longitude, business?.latitude], [-45.965, -23.305]);
  assert.equal(business?.externalIds?.geoapify, "geo-place-1");
});

test("não inventa telefone quando a feature não traz contato", () => {
  const business = normalizeGeoapifyFeature({ geometry: { coordinates: [-45.9, -23.3] }, properties: { name: "Sem telefone", city: "Jacareí", state: "São Paulo", categories: ["catering.restaurant.japanese"] } }, query);
  assert.equal(business?.phone, undefined);
});

test("mapeia restaurante japonês somente para categorias Geoapify relevantes", () => {
  assert.deepEqual(geoapifyCategories("Restaurante japonês"), ["catering.restaurant.japanese", "catering.restaurant.sushi", "catering.restaurant.ramen"]);
});

test("categoria oficial de restaurante tem prioridade sem exigir a palavra no nome", () => {
  assert.equal(assessNicheRelevance("Sushi Yama", "catering.restaurant, catering.restaurant.sushi", "Restaurante").relevant, true);
  assert.equal(assessNicheRelevance("Mercado Jacareí", "shop.supermarket", "Restaurante").relevant, false);
  assert.equal(assessNicheRelevance("Restaurante comum", "catering.restaurant", "Restaurante japonês").relevant, false);
});

test("enrichment exige identidade compatível e guarda evidência do telefone", async () => {
  const service = new ProspectEnrichmentService({
    getProviderName: () => "TEST_SEARCH",
    isConfigured: () => true,
    search: async () => [{ name: "Sushi Yama", city: "Jacareí", state: "São Paulo", address: "Rua A, 10", phone: "+55 12 99999-0000", phoneSourceUrl: "https://example.test/sushi", confidence: "HIGH" }],
  });
  const result = await service.enrich({ name: "Sushi Yama", city: "Jacareí", state: "São Paulo", address: "Rua A, 10", category: "catering.restaurant.sushi" }, query);
  assert.equal(result.attempted, true);
  assert.equal(result.foundPhone, true);
  assert.equal(result.business.phoneSource, "TEST_SEARCH");
  assert.equal(result.business.phoneSourceUrl, "https://example.test/sushi");
});

test("Tavily normaliza somente evidência compatível e nunca vira provider de descoberta", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ results: [
      { title: "Sakura Jacareí", url: "https://sakura.example/contato", content: "Sakura Jacareí - telefone (12) 3951-2040" },
      { title: "Outra cidade", url: "https://other.example", content: "Sakura São José dos Campos telefone (12) 3333-4444" },
    ] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const provider = new TavilyWebSearchProvider("test-key");
    assert.deepEqual(await provider.searchBusinesses({ state: "São Paulo", city: "Jacareí", niche: "Restaurante", quantity: 5 }), []);
    const evidence = await provider.search('"Sakura" "Jacareí" telefone', { name: "Sakura", city: "Jacareí", state: "São Paulo" });
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].phone, "+551239512040");
    assert.equal(evidence[0].phoneSourceUrl, "https://sakura.example/contato");
    assert.equal(requestBody?.api_key, "test-key");
    assert.equal(requestBody?.max_results, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Tavily trata rate limit sem quebrar o enrichment", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("quota", { status: 429 })) as typeof fetch;
  try {
    const provider = new TavilyWebSearchProvider("test-key");
    assert.deepEqual(await provider.search("empresa Jacareí telefone", { name: "Empresa", city: "Jacareí", state: "São Paulo" }), []);
    assert.equal(provider.getStatus(), "RATE_LIMITED");
    assert.deepEqual(await provider.search("segunda tentativa", { name: "Empresa", city: "Jacareí", state: "São Paulo" }), []);
    assert.equal(provider.getRequestCount(), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("matching Receita distingue nome, cidade, bairro, CEP e endereço", () => {
  const business = { name: "Sakura Restaurante", city: "Jacareí", state: "São Paulo", district: "Centro", address: "Rua A, 10", postalCode: "12345-000" };
  const exact = evaluateReceitaMatch(business, { cnpj: "1", businessName: "Sakura Restaurante LTDA", tradeName: "Sakura Restaurante", district: "Centro", postalCode: "12345-000", street: "Rua A" });
  assert.equal(exact.matchConfidence, "EXACT");
  const approximate = evaluateReceitaMatch(business, { cnpj: "2", businessName: "Sakura Restaurante LTDA", tradeName: "Sakura Restaurante Jacareí", district: "Centro", postalCode: null, street: "Rua B" });
  assert.ok(["EXACT", "HIGH", "MEDIUM"].includes(approximate.matchConfidence));
  const divergentPostal = evaluateReceitaMatch(business, { cnpj: "3", businessName: "Sakura Restaurante", tradeName: "Sakura Restaurante", district: "Centro", postalCode: "99999-000", street: "Rua B" });
  assert.equal(divergentPostal.matchConfidence, "LOW");
});

test("provider real usa geocoding e Places sem depender de MockDiscoveryProvider", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: URL | string) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/v1/geocode/search")) return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-45.965, -23.305] }, bbox: [-46.05, -23.38, -45.85, -23.2], properties: { place_id: "jacarei-boundary", city: "Jacareí", state: "São Paulo" } }] }), { status: 200 });
    return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-45.966, -23.306] }, properties: { place_id: "place-1", name: "Sushi Real", categories: ["catering.restaurant.japanese"], city: "Jacareí", state: "São Paulo", formatted: "Rua A, Jacareí", contact: { phone: "+55 12 99999-0000" } } }, { geometry: { coordinates: [-45.967, -23.307] }, properties: { place_id: "place-2", name: "Sem contato", categories: ["catering.restaurant.japanese"], city: "Jacareí", state: "São Paulo", formatted: "Rua B, Jacareí" } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const provider = new GeoapifyProvider("test-key");
    assert.equal(provider.getProviderName(), "GEOAPIFY");
    const results = await provider.searchBusinesses(query);
    assert.equal(results[0]?.city, "Jacareí");
    assert.deepEqual([results[0]?.longitude, results[0]?.latitude], [-45.966, -23.306]);
    assert.ok(urls.some((url) => url.includes("/v1/geocode/search")));
    assert.ok(urls.some((url) => url.includes("/v2/places") && url.includes("place%3Ajacarei-boundary")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
