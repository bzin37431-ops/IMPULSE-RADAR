import { useEffect, useMemo, useState } from "react";
import { del, get, patch } from "../services/api";
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
  opportunityScore: number;
  scoreBreakdown?: Record<string, number>;
  sourceProviders?: string[];
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
    [selected, setSelected] = useState<Layout>(),
    [tool, setTool] = useState<"approach" | "proposal" | undefined>(),
    [error, setError] = useState("");
  const load = () =>
    get<{ data: Layout[] }>("/api/prospecting/saved-layouts")
      .then((x) => setItems(x.data))
      .catch((e) => setError(e.message));
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(
    () => items.filter((x) => !status || x.commercialStatus === status),
    [items, status],
  );
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
      {error && <div className="panel error-state">{error}</div>}
      {!filtered.length && !error && (
        <div className="panel empty">
          <h2>Nenhum layout salvo.</h2>
          <p>Salve oportunidades em Buscar Layouts para trabalhar aqui.</p>
        </div>
      )}
      <div className="saved-layout-grid">
        {filtered.map((layout, index) => (
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
                  ? `${layout.business.rating.toFixed(1)} ★ · ${layout.business.reviewsCount || 0} avaliações`
                  : "Sem avaliação"}
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
        ))}
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
              {selected.business.phone && (
                <a
                  className="primary"
                  href={wa(selected.business)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir WhatsApp
                </a>
              )}
              {selected.business.phone && (
                <a
                  className="ghost"
                  href={wa(selected.business)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Testar WhatsApp
                </a>
              )}
              {selected.business.instagram && (
                <a
                  className="ghost"
                  href={selected.business.instagram}
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              )}
              {selected.business.mapsUrl && (
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
              <b>
                {selected.business.address ||
                  `${selected.business.city}, ${selected.business.state}`}
              </b>
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
            </div>
            <div className="drawer-section">
              <label>REPUTAÇÃO</label>
              <b>
                {selected.business.rating
                  ? `${selected.business.rating.toFixed(1)} / 5 · ${selected.business.reviewsCount || 0} avaliações`
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
