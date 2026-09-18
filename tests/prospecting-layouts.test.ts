import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../src/app.js";
import { MemoryStore } from "../src/store.js";

test("salva layout em entidade própria, é idempotente e persiste status/notas", async () => {
  const store = new MemoryStore(true);
  const app = buildApp({ store });
  const first = await app.inject({
    method: "POST",
    url: "/api/prospecting/searches",
    headers: { "idempotency-key": "layout-search-001" },
    payload: {
      state: "São Paulo",
      city: "São José dos Campos",
      niche: "Academia",
      sourceMode: "AMPLIADA",
      quantity: 5,
    },
  });
  const second = await app.inject({
    method: "POST",
    url: "/api/prospecting/searches",
    headers: { "idempotency-key": "layout-search-001" },
    payload: {
      state: "São Paulo",
      city: "São José dos Campos",
      niche: "Academia",
      sourceMode: "AMPLIADA",
      quantity: 5,
    },
  });
  assert.equal(first.statusCode, 200);
  assert.equal(second.json().idempotent, true);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const search = await app.inject({
    method: "GET",
    url: `/api/prospecting/searches/${first.json().data.id}`,
  });
  const business = search.json().data[0];
  const saved = await app.inject({
    method: "POST",
    url: `/api/prospecting/businesses/${business.id}/save-layout`,
  });
  assert.equal(saved.statusCode, 200);
  assert.equal(store.savedLayouts.length, 1);
  const updated = await app.inject({
    method: "PATCH",
    url: `/api/prospecting/saved-layouts/${saved.json().data.id}`,
    payload: { commercialStatus: "PARA_ABORDAR", notes: "Preparar abordagem" },
  });
  assert.equal(updated.json().data.commercialStatus, "PARA_ABORDAR");
  assert.equal(updated.json().data.notes, "Preparar abordagem");
  const listed = await app.inject({
    method: "GET",
    url: "/api/prospecting/saved-layouts",
  });
  assert.equal(listed.json().data.length, 1);
  assert.equal(listed.json().data[0].business.id, business.id);
  await app.close();
});

test("executa ações em massa, reverifica e exclui histórico com cascata", async () => {
  const store = new MemoryStore(true);
  const app = buildApp({ store });
  const created = await app.inject({
    method: "POST",
    url: "/api/prospecting/searches",
    payload: {
      state: "São Paulo",
      city: "São José dos Campos",
      niche: "Academia",
      sourceMode: "AMPLIADA",
      quantity: 5,
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const searchId = created.json().data.id;
  const results = await app.inject({
    method: "GET",
    url: `/api/prospecting/searches/${searchId}`,
  });
  const ids = results.json().data.slice(0, 2).map((item: { id: string }) => item.id);
  const bulk = await app.inject({
    method: "POST",
    url: "/api/prospecting/businesses/bulk",
    payload: { ids, action: "SAVE" },
  });
  assert.equal(bulk.json().data.saved, 2);
  const verified = await app.inject({
    method: "POST",
    url: `/api/prospecting/businesses/${ids[0]}/reverify`,
  });
  assert.equal(verified.statusCode, 200);
  assert.ok(verified.json().data.verifiedAt);
  const deleted = await app.inject({
    method: "DELETE",
    url: `/api/prospecting/searches/${searchId}`,
  });
  assert.equal(deleted.statusCode, 200);
  assert.equal(store.prospectingSearches.some((item) => item.id === searchId), false);
  assert.equal(store.savedLayouts.length, 0);
  await app.close();
});
