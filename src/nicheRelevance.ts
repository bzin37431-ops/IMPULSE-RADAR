const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const aliases: Record<string, string[]> = {
  academia: ["academia", "fitness", "treinamento", "musculação", "crossfit", "pilates", "yoga"],
  barbearia: ["barbearia", "barber", "corte masculino"],
  "salão de beleza": ["salão", "beleza", "cabeleireiro", "cabelos"],
  restaurante: ["restaurant", "restaurante", "catering.restaurant", "catering", "food", "dining", "bistro", "grill", "churrascaria", "cantina", "cozinha", "sushi", "pizzaria", "hamburgueria", "lanchonete"],
  "restaurante japonês": ["japanese", "japonês", "sushi", "sushi_bar", "ramen", "temaki", "temakeria", "izakaya", "culinária japonesa"],
  "clínica de estética": ["estética", "beleza", "dermatologia"],
  dentista: ["odontologia", "dentista", "odonto"],
  advocacia: ["advocacia", "advogado", "jurídico"],
};

const geoapify: Record<string, string[]> = {
  academia: ["commercial.sports_centre", "sport.fitness"],
  barbearia: ["service.beauty.hairdresser"],
  "salão de beleza": ["service.beauty.hairdresser"],
  restaurante: ["catering.restaurant"],
  "restaurante japonês": ["catering.restaurant.japanese", "catering.restaurant.sushi", "catering.restaurant.ramen"],
  "clínica de estética": ["healthcare", "service.beauty"],
  dentista: ["healthcare.dentist"],
  advocacia: ["office.lawyer"],
};

const matchingKey = (table: Record<string, unknown>, query: string) => Object.keys(table).sort((a, b) => b.length - a.length).find((item) => query.includes(normalize(item)));
const restaurantNegative = ["market", "supermarket", "mercado", "supermercado", "loja", "distribuidora"];
const restaurantCategoryEvidence = ["catering.restaurant", "catering", "food", "dining", "bistro", "grill", "churrascaria", "cantina", "sushi", "pizzaria", "hamburgueria", "lanchonete"];
const japaneseEvidence = ["japanese", "japonês", "sushi", "sushi_bar", "ramen", "temaki", "temakeria", "izakaya", "culinária japonesa"];

export type NicheRelevance = { relevant: boolean; score: number; reason: string };

export function geoapifyCategories(niche: string) {
  const key = matchingKey(geoapify, normalize(niche));
  return geoapify[key || "restaurante"];
}

export function assessNicheRelevance(name: string, category: string | undefined, niche: string): NicheRelevance {
  const query = normalize(niche);
  const haystack = normalize(`${name} ${category || ""}`);
  const key = matchingKey(aliases, query);
  if (!key) return { relevant: haystack.includes(query), score: haystack.includes(query) ? 50 : 0, reason: haystack.includes(query) ? "QUERY_MATCH" : "NO_ALIAS_MATCH" };
  if (key === "restaurante japonês") {
    const specific = japaneseEvidence.some((term) => haystack.includes(normalize(term)));
    return { relevant: specific, score: specific ? 100 : 0, reason: specific ? "JAPANESE_CATEGORY_OR_TERM" : "MISSING_JAPANESE_SIGNAL" };
  }
  if (key === "restaurante") {
    const hasNegative = restaurantNegative.some((term) => haystack.includes(normalize(term)));
    const categoryStrong = (category || "").split(",").some((term) => restaurantCategoryEvidence.some((evidence) => normalize(term).includes(normalize(evidence))));
    const semantic = aliases[key].some((term) => haystack.includes(normalize(term)));
    if (hasNegative && !categoryStrong) return { relevant: false, score: 0, reason: "NEGATIVE_NON_RESTAURANT_TERM" };
    if (categoryStrong) return { relevant: true, score: 100, reason: "OFFICIAL_RESTAURANT_CATEGORY" };
    if (semantic) return { relevant: true, score: 70, reason: "RESTAURANT_SEMANTIC_TERM" };
    return { relevant: false, score: 0, reason: "NO_RESTAURANT_SIGNAL" };
  }
  const terms = aliases[key];
  const matched = terms.some((term) => haystack.includes(normalize(term)));
  return { relevant: matched, score: matched ? 80 : 0, reason: matched ? "ALIAS_MATCH" : "NO_ALIAS_MATCH" };
}

export function isNicheRelevant(name: string, category: string | undefined, niche: string) {
  return assessNicheRelevance(name, category, niche).relevant;
}
