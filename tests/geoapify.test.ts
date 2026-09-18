import assert from "node:assert/strict";
import test from "node:test";
import { GeoapifyProvider, normalizeGeoapifyFeature } from "../src/providers/discovery/GeoapifyProvider.js";
import { geoapifyCategories } from "../src/nicheRelevance.js";

const query = { state: "São Paulo", city: "Jacareí", niche: "Restaurante japonês", quantity: 20, coverageMode: "STRICT" } as const;

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
