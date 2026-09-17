import { useEffect, useMemo, useState } from "react";
import "../prospecting.css";
import "../radar-theme.css";
import { get, post, patch } from "../services/api";
import { OpportunityMap } from "../components/OpportunityMap";
type Search = {
  isDemo?: boolean;
  level?: string;
  id: string;
  state: string;
  city: string;
  district?: string;
  niche: string;
  sourceMode: string;
  digitalStatus: string;
  minScore: number;
  quantity: number;
  coverageMode: string;
  status: string;
  progress: number;
  providersConsulted: number;
  uniqueResults: number;
  noWebsiteCount: number;
  socialOnlyCount: number;
  websiteCount: number;
  resultsCount: number;
  errorMessage?: string;
};
type Business = {
  id: string;
  name: string;
  category?: string;
  city: string;
  state: string;
  district?: string;
  phone?: string;
  instagram?: string;
  website?: string;
  mapsUrl?: string;
  rating?: number;
  reviewsCount?: number;
  digitalStatus: string;
  digitalStatusConfidence: string;
  opportunityScore: number;
  scoreBreakdown?: Record<string, number>;
  latitude?: number;
  longitude?: number;
  favorite: boolean;
  discarded: boolean;
};
const quantities = [5, 10, 20, 30, 50, 100, 150, 200, 300, 400, 500];
const scoreOptions = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const levels = { FRACO: "Fraco", MEDIO: "Médio", ALTO: "Alto", ULTRA: "Ultra" };
const digitalLabels = {
  UNKNOWN: "Todos",
  NO_WEBSITE_FOUND: "Sem site",
  SOCIAL_ONLY: "Só rede social",
  HAS_WEBSITE: "Com site",
} as Record<string, string>;
export function Prospecting({
  notify,
}: {
  notify: (value: {
    kind: "success" | "error" | "warning" | "info";
    title: string;
    description?: string;
  }) => void;
}) {
  useEffect(() => {
    const saved = localStorage.getItem("impulse.theme") || "dark";
    document.documentElement.dataset.theme = saved;
  }, []);
  const toggleTheme = () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("impulse.theme", next);
  };
  const [states, setStates] = useState<{ name: string; uf: string }[]>([]),
    [cities, setCities] = useState<string[]>([]),
    [districts, setDistricts] = useState<string[]>([]),
    [state, setState] = useState(""),
    [city, setCity] = useState(""),
    [district, setDistrict] = useState("Toda a cidade"),
    [niches, setNiches] = useState<string[]>([]),
    [niche, setNiche] = useState("Salão de beleza"),
    [level, setLevel] = useState("ALTO"),
    [digitalStatus, setDigitalStatus] = useState("UNKNOWN"),
    [minScore, setMinScore] = useState(0),
    [quantity, setQuantity] = useState(20),
    [coverageMode, setCoverageMode] = useState("INTELLIGENT"),
    [search, setSearch] = useState<Search>(),
    [results, setResults] = useState<Business[]>([]),
    [selectedId, setSelectedId] = useState<string>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      get<{ states: { name: string; uf: string }[] }>(
        "/api/prospecting/localities",
      ),
      get<{ data: string[] }>("/api/prospecting/niches"),
    ])
      .then(([locations, catalog]) => {
        setStates(locations.states);
        setNiches(catalog.data);
      })
      .catch((e) =>
        setError(`Não foi possível carregar os filtros: ${e.message}`),
      );
  }, []);
  useEffect(() => {
    if (state) {
      const selected = states.find((item) => item.name === state);
      setCity("");
      setDistrict("Toda a cidade");
      get<{ cities: string[] }>("/api/prospecting/localities", {
        state: selected?.uf,
      })
        .then((data) => setCities(data.cities))
        .catch((e) =>
          setError(`Não foi possível carregar as cidades: ${e.message}`),
        );
    }
  }, [state, states]);
  useEffect(() => {
    if (city && state) {
      get<{ data: string[] }>("/api/prospecting/districts", { state, city })
        .then((data) => setDistricts(data.data))
        .catch((e) => setDistricts(["Toda a cidade"]));
    }
  }, [city, state]);
  useEffect(() => {
    if (!search) return;
    let stopped = false;
    const refresh = () =>
      get<{ search: Search; data: Business[] }>(
        `/api/prospecting/searches/${search.id}`,
      )
        .then((data) => {
          if (stopped) return;
          setSearch(data.search);
          setResults(data.data);
          if (["QUEUED", "RUNNING"].includes(data.search.status))
            setTimeout(refresh, 700);
        })
        .catch((e) => setError(e.message));
    refresh();
    return () => {
      stopped = true;
    };
  }, [search?.id]);
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await post<{ data: Search }>("/api/prospecting/searches", {
        state,
        city,
        district: district === "Toda a cidade" ? undefined : district,
        niche,
        level,
        digitalStatus,
        minScore,
        quantity,
        coverageMode,
      });
      setSearch(data.data);
      setResults([]);
      notify({
        kind: "success",
        title: "Busca iniciada",
        description: "Os resultados serão atualizados em segundo plano.",
      });
    } catch (e: any) {
      setError(e.message);
      notify({
        kind: "error",
        title: "Não foi possível iniciar",
        description: e.message,
      });
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (search) await post(`/api/prospecting/searches/${search.id}/cancel`);
  };
  const save = async (item: Business) => {
    try {
      const response: any = await post(
        `/api/prospecting/businesses/${item.id}/save-lead`,
      );
      notify({
        kind: response.duplicate ? "warning" : "success",
        title: response.duplicate ? "Layout já existente" : "Layout salvo",
        description: response.duplicate
          ? "A oportunidade já está no CRM."
          : "Disponível em Meus Layouts.",
      });
    } catch (e: any) {
      notify({
        kind: "error",
        title: "Falha ao salvar lead",
        description: e.message,
      });
    }
  };
  const mapItems = useMemo(
    () => results.filter((item) => item.latitude && item.longitude),
    [results],
  );
  return (
    <>
      <section className="prospect-hero">
        <div>
          <span className="eyebrow">IMPULSE RADAR · DESCOBERTA LOCAL</span>
          <p>Encontre empresas e oportunidades em qualquer região do Brasil.</p>
        </div>
        <div className="prospect-hero-tools">
          <div className="prospect-disclaimer">
            Score de oportunidade é uma heurística operacional, não uma previsão
            de compra.
          </div>
          <button type="button" className="theme-toggle" onClick={toggleTheme}>
            Claro / Escuro
          </button>
        </div>
      </section>
      <form className="panel prospect-filters" onSubmit={start}>
        <div className="panel-title">
          <div>
            <span className="eyebrow">LOCAL E SEGMENTO</span>
            <h2>Defina onde prospectar</h2>
          </div>
          <span className="filter-required">
            Estado, cidade e nicho são obrigatórios
          </span>
        </div>
        <div className="form-grid prospect-grid">
          <label>
            Estado
            <input
              required
              list="prospect-states"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setCity("");
              }}
              placeholder="Digite para filtrar"
            />
            <datalist id="prospect-states">
              {states.map((item) => (
                <option key={item.uf} value={item.name} />
              ))}
            </datalist>
          </label>
          <label>
            Cidade
            <input
              required
              list="prospect-cities"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Digite para filtrar"
            />
            <datalist id="prospect-cities">
              {cities.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          <label>
            Região / Bairro
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="Toda a cidade">Toda a cidade</option>
              {districts
                .filter((item) => item !== "Toda a cidade")
                .map((item) => (
                  <option key={item}>{item}</option>
                ))}
            </select>
          </label>
          <label>
            Nicho
            <input
              required
              list="prospect-niches"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Digite para filtrar"
            />
            <datalist id="prospect-niches">
              {niches.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="prospect-divider" />
        <div className="panel-title">
          <div>
            <span className="eyebrow">QUALIDADE E VOLUME</span>
            <h2>Refine a descoberta</h2>
          </div>
        </div>
        <div className="form-grid prospect-grid">
          <label>
            Nível da busca
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {Object.entries(levels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status digital
            <select
              value={digitalStatus}
              onChange={(e) => setDigitalStatus(e.target.value)}
            >
              {Object.entries(digitalLabels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Score mínimo
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            >
              {scoreOptions.map((item) => (
                <option key={item} value={item}>
                  {item === 0 ? "Todos" : `${item}+`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantidade
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            >
              {quantities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Cobertura
            <select
              value={coverageMode}
              onChange={(e) => setCoverageMode(e.target.value)}
            >
              <option value="INTELLIGENT">Cobertura inteligente</option>
              <option value="STRICT">Estrita</option>
              <option value="BROAD">Ampla</option>
            </select>
          </label>
        </div>
        <div className="prospect-actions">
          <button
            className="primary"
            disabled={busy || !state || !city || !niche}
          >
            {busy ? "Iniciando…" : "Buscar layouts"}
          </button>
          {search && ["QUEUED", "RUNNING"].includes(search.status) && (
            <button
              type="button"
              className="ghost"
              onClick={() => void cancel()}
            >
              Cancelar busca
            </button>
          )}
        </div>
      </form>
      {error && <div className="panel error-state">{error}</div>}
      {search && (
        <section className="prospect-results">
          <div className="prospect-results-head">
            <div>
              <span className="eyebrow">RESULTADOS DA BUSCA</span>
              <h2>
                {search.status === "RUNNING"
                  ? "Analisando empresas…"
                  : search.status === "COMPLETED"
                    ? "Layouts encontrados"
                    : "Busca em andamento"}
              </h2>
              {search.isDemo && (
                <span className="demo-badge">DADOS DE DEMONSTRAÇÃO</span>
              )}
            </div>
            <div className="prospect-stats">
              <span>
                <b>{search.resultsCount}</b> / {search.quantity} encontradas
              </span>
              <span>
                <b>{search.noWebsiteCount}</b> sem site
              </span>
              <span>
                <b>{search.socialOnlyCount}</b> só rede social
              </span>
              <span>
                <b>{search.progress}%</b> progresso
              </span>
            </div>
          </div>
          {search.status === "RUNNING" && (
            <div className="progress-track">
              <i style={{ width: `${search.progress}%` }} />
            </div>
          )}
          {search.status === "COMPLETED" &&
            search.resultsCount < search.quantity && (
              <p className="partial-results">
                {search.resultsCount} de {search.quantity} encontradas. Não
                foram encontradas mais oportunidades compatíveis.
              </p>
            )}
          {!results.length && search.status === "COMPLETED" ? (
            <div className="panel empty">
              <h2>Nenhuma oportunidade encontrada com estes filtros.</h2>
            </div>
          ) : (
            <div className="prospect-split">
              <div className="prospect-list">
                {results.map((item) => (
                  <article
                    className={`prospect-card ${selectedId === item.id ? "selected" : ""}`}
                    id={`prospect-${item.id}`}
                    onClick={() => setSelectedId(item.id)}
                    key={item.id}
                  >
                    <div className="prospect-card-top">
                      <div>
                        <h3>{item.name}</h3>
                        <small>
                          {item.category} · {item.city}
                          {item.district ? ` · ${item.district}` : ""}
                        </small>
                      </div>
                      <strong className="score-badge">
                        {item.opportunityScore}
                      </strong>
                    </div>
                    <div className="prospect-card-meta">
                      <span
                        className={`digital-${item.digitalStatus.toLowerCase()}`}
                      >
                        {digitalLabels[item.digitalStatus] ||
                          item.digitalStatus}
                      </span>
                      <span>{item.phone || "Sem telefone"}</span>
                      <span>
                        {item.rating
                          ? `${item.rating.toFixed(1)} ★ · ${item.reviewsCount || 0} avaliações`
                          : "Sem avaliação"}
                      </span>
                    </div>
                    <div className="prospect-card-actions">
                      <button
                        className="ghost"
                        onClick={() =>
                          void patch(`/api/prospecting/businesses/${item.id}`, {
                            favorite: !item.favorite,
                          })
                        }
                      >
                        {item.favorite ? "★ Favorita" : "☆ Favoritar"}
                      </button>
                      <button
                        className="primary"
                        onClick={() => void save(item)}
                      >
                        Salvar layout
                      </button>
                      {item.website && (
                        <a
                          className="ghost"
                          href={item.website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir site
                        </a>
                      )}
                      {item.instagram && (
                        <a
                          className="ghost"
                          href={item.instagram}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Instagram
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              <div className="prospect-map">
                <div className="map-header">
                  <span className="eyebrow">MAPA DE LAYOUTS</span>
                  <span>{mapItems.length} coordenadas</span>
                </div>
                <OpportunityMap
                  items={mapItems}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <p className="map-note">
                  {search.isDemo
                    ? "Dados de demonstração"
                    : "Dados encontrados pelos provedores configurados"}
                </p>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
