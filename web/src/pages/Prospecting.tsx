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
  sourceProviders?: string[];
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
function ComboBox({
  label,
  value,
  options,
  onChange,
  required,
  loading = false,
  placeholder,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  loading?: boolean;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(value),
    [active, setActive] = useState(0);
  const filtered = options
    .filter((item) =>
      item
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .slice(0, 200);
  useEffect(() => setQuery(value), [value]);
  return (
    <label className="combo-label">
      {label}
      <div className="combo-box">
        <input
          required={required}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((index) => Math.min(index + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (e.key === "Enter" && filtered[active]) {
              e.preventDefault();
              onChange(filtered[active]);
              setQuery(filtered[active]);
              setOpen(false);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        <button
          type="button"
          className="combo-toggle"
          onClick={() => setOpen((current) => !current)}
          aria-label={`Abrir opções de ${label}`}
        >
          ⌄
        </button>
        {open && (
          <div className="combo-options" role="listbox">
            {loading ? (
              <div className="combo-empty">Carregando…</div>
            ) : filtered.length ? (
              filtered.map((item, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? "active" : ""}
                  key={item}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(item);
                    setQuery(item);
                    setOpen(false);
                  }}
                >
                  {item}
                </button>
              ))
            ) : (
              <div className="combo-empty">Nenhuma opção encontrada.</div>
            )}
          </div>
        )}
      </div>
    </label>
  );
}
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
    [selectedIds, setSelectedIds] = useState<string[]>([]),
    [resultPage, setResultPage] = useState(0),
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
    const hashQuery = location.hash.split("?")[1] || "";
    const id =
      new URLSearchParams(hashQuery).get("searchId") ||
      sessionStorage.getItem("impulse.reopenSearchId");
    if (!id) return;
    sessionStorage.removeItem("impulse.reopenSearchId");
    get<{ search: Search; data: Business[] }>(`/api/prospecting/searches/${id}`)
      .then((data) => {
        setSearch(data.search);
        setResults(data.data);
        setResultPage(0);
      })
      .catch((e) => setError(e.message));
  }, []);
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
        idempotencyKey: [
          state,
          city,
          district,
          niche,
          level,
          digitalStatus,
          minScore,
          quantity,
          coverageMode,
        ]
          .join("|")
          .toLowerCase(),
      });
      setSearch(data.data);
      setResults([]);
      setResultPage(0);
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
  const bulk = async (action: "SAVE" | "DISCARD") => {
    if (!selectedIds.length) return;
    try {
      const response = await post<{ data: { saved: number; alreadySaved: number; discarded: number } }>(
        "/api/prospecting/businesses/bulk",
        { ids: selectedIds, action },
      );
      if (action === "DISCARD")
        setResults((items) => items.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
      notify({
        kind: "success",
        title: action === "SAVE" ? "Layouts salvos" : "Oportunidades descartadas",
        description:
          action === "SAVE"
            ? `${response.data.saved} novos · ${response.data.alreadySaved} já salvos.`
            : `${response.data.discarded} oportunidades removidas dos resultados.`,
      });
    } catch (e: any) {
      notify({ kind: "error", title: "Ação em massa indisponível", description: e.message });
    }
  };
  const exportSelected = () => {
    const rows = results.filter((item) => selectedIds.includes(item.id));
    const csv = [
      "Empresa,Telefone,Cidade,Estado,Nicho,Score,Status digital",
      ...rows.map((item) =>
        [item.name, item.phone, item.city, item.state, item.category, item.opportunityScore, digitalLabels[item.digitalStatus] || item.digitalStatus]
          .map((value) => `"${String(value || "").replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "impulse-layouts-selecionados.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const visibleResults = results.slice(resultPage * 50, resultPage * 50 + 50);
  const pageCount = Math.max(1, Math.ceil(results.length / 50));
  const save = async (item: Business) => {
    try {
      const response: any = await post(
        `/api/prospecting/businesses/${item.id}/save-layout`,
      );
      notify({
        kind: response.duplicate ? "warning" : "success",
        title: response.duplicate ? "Layout já existente" : "Layout salvo",
        description: response.duplicate
          ? "A oportunidade já está no CRM."
          : "Persistido no PostgreSQL e disponível em Meus Layouts.",
      });
    } catch (e: any) {
      notify({
        kind: "error",
        title: "Falha ao salvar layout",
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
          <ComboBox
            label="Estado"
            required
            value={state}
            options={states.map((item) => item.name)}
            onChange={(value) => {
              setState(value);
              setCity("");
            }}
            placeholder="Digite para filtrar"
          />
          <ComboBox
            label="Cidade"
            required
            value={city}
            options={cities}
            onChange={setCity}
            placeholder="Digite para filtrar"
            loading={Boolean(state) && !cities.length}
          />
          <ComboBox
            label="Região / Bairro"
            value={district}
            options={districts.length ? districts : ["Toda a cidade"]}
            onChange={setDistrict}
            placeholder="Toda a cidade"
            loading={Boolean(city) && !districts.length}
          />
          <ComboBox
            label="Nicho"
            required
            value={niche}
            options={niches}
            onChange={setNiche}
            placeholder="Digite para filtrar"
            loading={!niches.length}
          />
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
                <span className="demo-badge">
                  SIMULAÇÃO · contatos e avaliações reais indisponíveis
                </span>
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
                <b>{search.status === "COMPLETED" ? 100 : search.progress}%</b> progresso
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
          {results.length > 0 && (
            <div className="prospect-bulk-actions">
              <span>{selectedIds.length} selecionadas</span>
              <button className="ghost" disabled={!selectedIds.length} onClick={() => void bulk("SAVE")}>
                Salvar selecionadas
              </button>
              <button className="ghost" disabled={!selectedIds.length} onClick={exportSelected}>
                Exportar selecionadas
              </button>
              <button className="danger" disabled={!selectedIds.length} onClick={() => void bulk("DISCARD")}>
                Descartar selecionadas
              </button>
            </div>
          )}
          {!results.length && search.status === "COMPLETED" ? (
            <div className="panel empty">
              <h2>Nenhuma oportunidade encontrada com estes filtros.</h2>
            </div>
          ) : (
            <div className="prospect-split">
              <div className="prospect-list">
                {visibleResults.map((item, visibleIndex) => {
                  const isMockBusiness = item.sourceProviders?.some((source) => source.toLowerCase().startsWith("mock")) ?? false;
                  return (
                  <article
                    className={`prospect-card ${selectedId === item.id ? "selected" : ""}`}
                    id={`prospect-${item.id}`}
                    onClick={() => setSelectedId(item.id)}
                    key={item.id}
                  >
                    <div className="prospect-card-top">
                      <div>
                        <label className="prospect-select" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) =>
                              setSelectedIds((ids) =>
                                e.target.checked
                                  ? [...ids, item.id]
                                  : ids.filter((id) => id !== item.id),
                              )
                            }
                          />
                          Selecionar
                        </label>
                        <span className="result-rank">
                          #{String(resultPage * 50 + visibleIndex + 1).padStart(2, "0")}
                        </span>
                        <h3>{item.name}</h3>
                        <small>
                          {item.category} · {item.city}
                          {item.district ? ` · ${item.district}` : ""}
                        </small>
                      </div>
                      <strong className="score-label">
                        Score {item.opportunityScore}
                      </strong>
                    </div>
                    <div className="prospect-card-meta">
                      <span
                        className={`digital-${item.digitalStatus.toLowerCase()}`}
                      >
                        {digitalLabels[item.digitalStatus] ||
                          item.digitalStatus}
                      </span>
                      {item.phone && !isMockBusiness ? (
                        <a
                          className="contact-chip"
                          href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          ☎ {item.phone}
                        </a>
                      ) : isMockBusiness ? (
                        <span>Contato real indisponível na simulação</span>
                      ) : (
                        <span>Telefone não localizado</span>
                      )}
                      <span className="rating-chip">
                        {!isMockBusiness && typeof item.rating === "number"
                          ? `Google ${item.rating.toFixed(1)} ★ · ${item.reviewsCount || 0} avaliações`
                          : isMockBusiness ? "Avaliação Google real indisponível na simulação" : "Avaliação Google não localizada"}
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
                      {item.website && !isMockBusiness && (
                        <a
                          className="ghost"
                          href={item.website}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Abrir site real
                        </a>
                      )}
                      {item.instagram && !isMockBusiness && (
                        <a
                          className="ghost"
                          href={item.instagram}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Abrir Instagram real
                        </a>
                      )}
                    </div>
                  </article>
                  );
                })}
                {results.length > 50 && (
                  <div className="prospect-pagination">
                    <button className="ghost" disabled={resultPage === 0} onClick={() => setResultPage((page) => page - 1)}>
                      Anterior
                    </button>
                    <span>Página {resultPage + 1} de {pageCount}</span>
                    <button className="ghost" disabled={resultPage >= pageCount - 1} onClick={() => setResultPage((page) => page + 1)}>
                      Próxima
                    </button>
                  </div>
                )}
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
