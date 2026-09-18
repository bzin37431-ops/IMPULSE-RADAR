import { useEffect, useMemo, useState } from "react";
import { del, get, patch, post } from "../services/api";
const digitalLabels: Record<string, string> = {
  UNKNOWN: "Todos",
  NO_WEBSITE_FOUND: "Sem site",
  SOCIAL_ONLY: "Só rede social",
  HAS_WEBSITE: "Com site",
};

type Business = {
  id: string;
  name: string;
  category?: string;
  city: string;
  state: string;
  district?: string;
  phone?: string;
  normalizedPhone?: string;
  instagram?: string;
  mapsUrl?: string;
  address?: string;
  rating?: number;
  reviewsCount?: number;
  digitalStatus: string;
  digitalStatusConfidence: string;
  websiteConfidence: string;
  socialConfidence: string;
  phoneConfidence: string;
  sourceProviders?: string[];
  opportunityScore: number;
  scoreBreakdown?: Record<string, number>;
  sourceProviders?: string[];
  verifiedAt?: string;
};
type Status =
  | "NOVO"
  | "PARA_ABORDAR"
  | "ABORDADO"
  | "AGUARDANDO_RESPOSTA"
  | "INTERESSADO"
  | "PROPOSTA"
  | "FECHADO"
  | "DESCARTADO";
type Layout = {
  id: string;
  prospectBusinessId: string;
  commercialStatus: Status;
  notes?: string;
  savedAt: string;
  business: Business;
};
const statusLabels: Record<Status, string> = {
  NOVO: "Novo",
  PARA_ABORDAR: "Para abordar",
  ABORDADO: "Abordado",
  AGUARDANDO_RESPOSTA: "Aguardando resposta",
  INTERESSADO: "Interessado",
  PROPOSTA: "Proposta",
  FECHADO: "Fechado",
  DESCARTADO: "Descartado",
};
const wa = (item: Business) =>
  `https://wa.me/${item.normalizedPhone?.replace("+", "") || item.phone?.replace(/\D/g, "") || ""}`;
const approach = (item: Business) =>
  `Olá! Encontrei a ${item.name} em ${item.city}${item.category ? ` e vi que atua com ${item.category}` : ""}. Trabalho com estruturas digitais para empresas locais. Posso te mostrar uma ideia objetiva?`;
const structure = (item: Business) =>
  (item.category || "").toLowerCase().includes("japon")
    ? ["Home", "Cardápio", "Sobre", "Galeria", "Localização", "Contato"]
    : [
        "Home",
        "Sobre a empresa",
        "Serviços",
        "Galeria",
        "Localização",
        "Contato",
      ];
function ProposalForm({ item }: { item: Business }) {
  const [value, setValue] = useState(""),
    [deadline, setDeadline] = useState("15"),
    [notes, setNotes] = useState("");
  const text = `Proposta para ${item.name}\n\nSituação digital: ${digitalLabels[item.digitalStatus] || item.digitalStatus}.\nSolução: estrutura de site sob medida para ${item.category || "o negócio"}.\nEstrutura sugerida: ${structure(item).join(" · ")}.\nBenefícios: presença digital clara, contato facilitado e apresentação dos serviços.\nPrazo: ${deadline} dias.\nValor: ${value || "a combinar"}.\nObservação: ${notes || "próximo passo a combinar"}.`;
  return (
    <>
      <label>
        Valor
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="R$"
        />
      </label>
      <label>
        Prazo (dias)
        <input value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </label>
      <label>
        Observação
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <textarea readOnly value={text} />
      <button
        className="primary"
        onClick={() => navigator.clipboard.writeText(text)}
      >
        Copiar proposta
      </button>
    </>
  );
}
export function SavedLayouts() {
  const [items, setItems] = useState<Layout[]>([]),
    [status, setStatus] = useState<Status | "">(""),
    [stateFilter, setStateFilter] = useState(""),
    [cityFilter, setCityFilter] = useState(""),
    [districtFilter, setDistrictFilter] = useState(""),
    [nicheFilter, setNicheFilter] = useState(""),
    [digitalFilter, setDigitalFilter] = useState(""),
    [scoreFilter, setScoreFilter] = useState(""),
    [selected, setSelected] = useState<Layout>(),
    [tool, setTool] = useState<"approach" | "proposal" | undefined>(),
    [error, setError] = useState("");
  const load = () =>
    get<{ data: Layout[] }>("/api/prospecting/saved-layouts")
      .then((x) => setItems(x.data))
      .catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(
    () => items.filter((x) => {
      const business = x.business;
      return (!status || x.commercialStatus === status) &&
        (!stateFilter || business.state === stateFilter) &&
        (!cityFilter || business.city === cityFilter) &&
        (!districtFilter || (business.district || "") === districtFilter) &&
        (!nicheFilter || (business.category || "") === nicheFilter) &&
        (!digitalFilter || business.digitalStatus === digitalFilter) &&
        (!scoreFilter || business.opportunityScore >= Number(scoreFilter));
    }),
    [items, status, stateFilter, cityFilter, districtFilter, nicheFilter, digitalFilter, scoreFilter],
  );
  const filterOptions = useMemo(() => ({
    states: [...new Set(items.map((item) => item.business.state))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    cities: [...new Set(items.map((item) => item.business.city))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    districts: [...new Set(items.map((item) => item.business.district).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR")),
    niches: [...new Set(items.map((item) => item.business.category).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR")),
  }), [items]);
  const update = async (id: string, body: Partial<Layout>) => {
    const x = await patch<{ data: Layout }>(
      `/api/prospecting/saved-layouts/${id}`,
      body,
    );
    setItems((v) => v.map((i) => (i.id === id ? { ...i, ...x.data } : i)));
    setSelected((v) => (v?.id === id ? { ...v, ...x.data } : v));
  };
  const remove = async (id: string) => {
    await del(`/api/prospecting/saved-layouts/${id}`);
    setItems((v) => v.filter((i) => i.id !== id));
    setSelected(undefined);
  };
  const reverify = async (item: Layout) => {
    const response = await post<{ data: Business }>(
      `/api/prospecting/businesses/${item.business.id}/reverify`,
    );
    setItems((current) =>
      current.map((layout) =>
        layout.id === item.id ? { ...layout, business: response.data } : layout,
      ),
    );
    setSelected((current) =>
      current?.id === item.id ? { ...current, business: response.data } : current,
    );
  };
  return (
    <section className="saved-layouts">
      <div className="hero-row">
        <p className="muted">
          Layouts salvos para trabalhar oportunidades reais da prospecção.
        </p>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | "")}
        >
          <option value="">Todos os status</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="panel saved-layout-filters">
        <span className="eyebrow">FILTRAR LAYOUTS</span>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="">Todos os estados</option>
          {filterOptions.states.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value="">Todas as cidades</option>
          {filterOptions.cities.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
          <option value="">Todos os bairros</option>
          {filterOptions.districts.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)}>
          <option value="">Todos os nichos</option>
          {filterOptions.niches.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={digitalFilter} onChange={(e) => setDigitalFilter(e.target.value)}>
          <option value="">Todos os status digitais</option>
          {Object.entries(digitalLabels).filter(([key]) => key !== "UNKNOWN").map(([key, value]) => <option value={key} key={key}>{value}</option>)}
        </select>
        <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}>
          <option value="">Qualquer score</option>
          {[20, 40, 60, 70, 80, 90].map((value) => <option value={value} key={value}>{value}+</option>)}
        </select>
      </div>
      {error && <div className="panel error-state">{error}</div>}
      {!filtered.length && !error && (
        <div className="panel empty">
          <h2>Nenhum layout salvo.</h2>
          <p>Salve oportunidades em Buscar Layouts para trabalhar aqui.</p>
        </div>
      )}
      <div className="saved-layout-grid">
        {filtered.map((layout, index) => {
          const isMockBusiness = layout.business.sourceProviders?.some((source) => source.toLowerCase().startsWith("mock")) ?? false;
          return (
          <article
            className="panel saved-layout-card"
            key={layout.id}
            onClick={() => setSelected(layout)}
          >
            <div className="prospect-card-top">
              <div>
                <span className="eyebrow">
                  #{String(index + 1).padStart(2, "0")} · LAYOUT SALVO
                </span>
                <h2>{layout.business.name}</h2>
                <p className="muted">
                  {layout.business.category || "Nicho não informado"} ·{" "}
                  {layout.business.city}, {layout.business.state}
                </p>
              </div>
              <div>
                <strong className="score-badge">
                  Score {layout.business.opportunityScore}
                </strong>
                <span className="layout-status">
                  {statusLabels[layout.commercialStatus]}
                </span>
              </div>
            </div>
            <div className="prospect-card-meta">
              <span>
                {digitalLabels[layout.business.digitalStatus] ||
                  layout.business.digitalStatus}
              </span>
              <span>{layout.business.phone || "Telefone não localizado"}</span>
              <span>
                {layout.business.rating
                  ? isMockBusiness ? "Avaliação Google real indisponível na simulação" : `Google ${layout.business.rating.toFixed(1)} ★ · ${layout.business.reviewsCount || 0} avaliações`
                  : "Avaliação Google não localizada"}
              </span>
            </div>
            <div className="prospect-card-actions">
              <select
                value={layout.commercialStatus}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  void update(layout.id, {
                    commercialStatus: e.target.value as Status,
                  })
                }
              >
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </article>
          );
        })}
      </div>
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(undefined)}>
          <aside
            className="drawer layout-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={() => setSelected(undefined)}>
              ×
            </button>
            <span className="eyebrow">DETALHE DO LAYOUT</span>
            <h2>{selected.business.name}</h2>
            <p className="muted">
              {selected.business.category || "Nicho não informado"} ·{" "}
              {selected.business.city}, {selected.business.state}
            </p>
            <div className="quick-actions">
              <button
                className="ghost"
                onClick={() =>
                  navigator.clipboard.writeText(selected.business.phone || "")
                }
              >
                Copiar telefone
              </button>
              {selected.business.phone && !selected.business.sourceProviders?.some((source) => source.toLowerCase().startsWith("mock")) && (
                <a
                  className="primary"
                  href={wa(selected.business)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir WhatsApp
                </a>
              )}
              {selected.business.phone && !selected.business.sourceProviders?.some((source) => source.toLowerCase().startsWith("mock")) && (
                <a
                  className="ghost"
                  href={wa(selected.business)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Testar WhatsApp
                </a>
              )}
              {selected.business.instagram && !selected.business.sourceProviders?.some((source) => source.toLowerCase().startsWith("mock")) && (
                <a
                  className="ghost"
                  href={selected.business.instagram}
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              )}
              {selected.business.mapsUrl && !selected.business.sourceProviders?.some((source) => source.toLowerCase().startsWith("mock")) && (
                <a
                  className="ghost"
                  href={selected.business.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Maps
                </a>
              )}
            </div>
            <div className="drawer-section">
              <label>RESUMO</label>
              <p>
                Oportunidade para uma estrutura digital de{" "}
                {selected.business.category || "negócio local"}, baseada nos
                dados confirmados.
              </p>
            </div>
              <div className="drawer-section">
                <label>CONTATO</label>
              <b>{selected.business.phone || "Não localizado"}</b>
              <small>Telefone: {selected.business.phoneConfidence}</small>
              <b>
                {selected.business.address ||
                  `${selected.business.city}, ${selected.business.state}`}
              </b>
              </div>
            <div className="drawer-section">
              <label>LOCALIZAÇÃO</label>
              <b>{selected.business.address || "Endereço não informado"}</b>
              <small>
                {selected.business.district ? `${selected.business.district} · ` : ""}
                {selected.business.city}, {selected.business.state}
              </small>
            </div>
            <div className="drawer-section">
              <label>PRESENÇA DIGITAL</label>
              <b>
                {digitalLabels[selected.business.digitalStatus] ||
                  selected.business.digitalStatus}
              </b>
              <small>
                Confiança: {selected.business.digitalStatusConfidence}
              </small>
              <small>
                Site: {selected.business.websiteConfidence} · Redes: {selected.business.socialConfidence}
              </small>
            </div>
            <div className="drawer-section">
              <label>REPUTAÇÃO</label>
              <b>
                {selected.business.rating && !selected.business.sourceProviders?.some((source) => source.toLowerCase().startsWith("mock"))
                  ? `Google ${selected.business.rating.toFixed(1)} / 5 · ${selected.business.reviewsCount || 0} avaliações`
                  : "Sem avaliação"}
              </b>
            </div>
            <div className="drawer-section">
              <label>SCORE</label>
              <h3>Score {selected.business.opportunityScore}</h3>
              <p>
                {Object.entries(selected.business.scoreBreakdown || {})
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ") || "Heurística baseada nos sinais disponíveis."}
              </p>
            </div>
            <div className="drawer-section">
              <label>FONTES</label>
              <p>
                {selected.business.sourceProviders?.join(", ") ||
                  "Fonte não informada"}
              </p>
            </div>
            <div className="drawer-section">
              <label>VERIFICAÇÃO</label>
              <p>
                {selected.business.verifiedAt
                  ? `Verificado em ${new Date(selected.business.verifiedAt).toLocaleString("pt-BR")}`
                  : "Ainda não verificado"}
              </p>
              <button className="ghost" onClick={() => void reverify(selected)}>
                Reverificar presença digital
              </button>
            </div>
            <div className="drawer-section">
              <label>STATUS COMERCIAL</label>
              <select
                value={selected.commercialStatus}
                onChange={(e) =>
                  void update(selected.id, {
                    commercialStatus: e.target.value as Status,
                  })
                }
              >
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="drawer-section">
              <label>NOTAS</label>
              <textarea
                defaultValue={selected.notes || ""}
                onBlur={(e) =>
                  void update(selected.id, { notes: e.currentTarget.value })
                }
                placeholder="Anotações da oportunidade"
              />
            </div>
            <div className="quick-actions">
              <button className="ghost" onClick={() => setTool("approach")}>
                Copiar abordagem
              </button>
              <button className="ghost" onClick={() => setTool("proposal")}>
                Gerar proposta
              </button>
              <button
                className="ghost"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `Estrutura sugerida: ${structure(selected.business).join(" · ")}`,
                  )
                }
              >
                Gerar estrutura de site
              </button>
              <button
                className="danger"
                onClick={() => void remove(selected.id)}
              >
                Remover dos salvos
              </button>
            </div>
          </aside>
        </div>
      )}
      {tool && selected && (
        <div className="drawer-backdrop" onClick={() => setTool(undefined)}>
          <div
            className="panel generation-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={() => setTool(undefined)}>
              ×
            </button>
            <span className="eyebrow">
              GERAÇÃO LOCAL · NÃO ENVIA AUTOMATICAMENTE
            </span>
            <h2>
              {tool === "approach" ? "Gerar abordagem" : "Gerar proposta"}
            </h2>
            {tool === "approach" ? (
              <>
                <textarea readOnly value={approach(selected.business)} />
                <button
                  className="primary"
                  onClick={() =>
                    navigator.clipboard.writeText(approach(selected.business))
                  }
                >
                  Copiar abordagem
                </button>
              </>
            ) : (
              <ProposalForm item={selected.business} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
