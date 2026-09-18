import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./theme.css";
import { get, post, patch, del } from "./services/api";
import { Lead, Message, Conversation, Task, labels } from "./types";
import { Modal, Toast, ToastState } from "./components/Toast";
import { LeadImport } from "./components/LeadImport";
import { GlobalSearch } from "./components/GlobalSearch";
import { Prospecting } from "./pages/Prospecting";
import { SavedLayouts } from "./pages/SavedLayouts";
import { searchModeLabel, searchStatusLabel } from "./searchLabels";
import "./saved-layouts.css";
import { ProspectingMap as RealProspectingMap } from "./pages/ProspectingMap";
import "./radar-map-page.css";
type Page =
  | "prospecting"
  | "dashboard"
  | "leads"
  | "prospecting-map"
  | "search-history"
  | "integrations"
  | "account";
const nav: [Page, string, string][] = [
  ["prospecting", "Buscar Layouts", "⌕"],
  ["dashboard", "Visão Geral", "⌂"],
  ["leads", "Meus Layouts", "◌"],
  ["prospecting-map", "Mapa", "⌖"],
  ["search-history", "Histórico", "◷"],
  ["integrations", "Integrações", "⌘"],
  ["account", "Minha conta", "◉"],
];
function App() {
  const [page, setPage] = useState<Page>(
    (location.hash.slice(1) || "prospecting") as Page,
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dash, setDash] = useState<any>();
  const [toast, setToast] = useState<ToastState>();
  const [reload, setReload] = useState(0);
  const [drawer, setDrawer] = useState<Lead>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    const f = () => setPage((location.hash.slice(1) || "prospecting") as Page);
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  useEffect(() => {
    setLoading(true);
    setLoadError("");
    Promise.all([
      get<any>("/api/leads", { limit: "100" }),
      get<any>("/api/conversations"),
      get<any>("/api/dashboard"),
    ])
      .then(([leadData, conversationData, dashboardData]) => {
        setLeads(leadData.data);
        setDrawer((current) =>
          current
            ? leadData.data.find((lead: Lead) => lead.id === current.id) ||
              current
            : current,
        );
        const openId = sessionStorage.getItem("impulse.openLeadId");
        const found = leadData.data.find((lead: Lead) => lead.id === openId);
        if (found) {
          setDrawer(found);
          sessionStorage.removeItem("impulse.openLeadId");
        }
        setConversations(conversationData.data);
        setDash(dashboardData);
      })
      .catch((e) => {
        setLoadError(e.message || "Não foi possível carregar os dados");
        setToast({
          kind: "error",
          title: "Falha ao carregar",
          description: e.message,
        });
      })
      .finally(() => setLoading(false));
  }, [page, reload]);
  const notify = (t: ToastState) => setToast(t);
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span className="mark">⌁</span>
          <span>
            IMPULSE <small>RADAR</small>
          </span>
        </div>
        <div className="workspace">
          <span className="avatar">⌁</span>
          <span>
            <b>Impulse Radar</b>
            <small>Prospecção local</small>
          </span>
        </div>
        <nav>
          {nav.map(([id, text, icon]) => (
            <a className={page === id ? "active" : ""} href={"#" + id} key={id}>
              <i>{icon}</i>
              {text}
              {id === "conversations" && conversations.length > 0 && (
                <em>{conversations.length}</em>
              )}
            </a>
          ))}
        </nav>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">IMPULSE RADAR · PROSPECÇÃO</span>
            <h1>{nav.find((x) => x[0] === page)?.[1] || "Detalhes"}</h1>
          </div>
          <GlobalSearch />
          <div className="profile">
            <span className="avatar dark">⌁</span>
            <span>
              <b>Minha conta</b>
              <small>Conta</small>
            </span>
          </div>
        </header>
        {toast && <Toast toast={toast} close={() => setToast(undefined)} />}{" "}
        {loading && (
          <div className="panel loading-state app-loading">
            Carregando dados da operação…
          </div>
        )}
        {loadError && (
          <div className="panel error-state app-error">
            <h3>Não foi possível carregar os dados</h3>
            <p>{loadError}</p>
            <button className="primary" onClick={() => setReload((x) => x + 1)}>
              Tentar novamente
            </button>
          </div>
        )}
        {!loading && !loadError && (
          <>
            {page === "prospecting" && <Prospecting notify={notify} />}{" "}
            {page === "dashboard" && <ProspectingOverview />}{" "}
            {page === "prospecting-map" && <RealProspectingMap />}{" "}
            {page === "search-history" && <SearchHistory />}{" "}
            {page === "integrations" && <Integrations />}{" "}
            {page === "account" && <Account />}{" "}
            {page === "leads" && <SavedLayouts />}{" "}
            {page === "pipeline" && (
              <Pipeline
                leads={leads}
                refresh={() => setReload((x) => x + 1)}
                notify={notify}
              />
            )}{" "}
            {page === "conversations" && (
              <Conversations conversations={conversations} notify={notify} />
            )}{" "}
            {page === "campaigns" && <Campaigns notify={notify} />}{" "}
            {page === "templates" && <Templates notify={notify} />}{" "}
            {page === "tasks" && <Tasks leads={leads} notify={notify} />}{" "}
            {page === "quality" && <Quality />}
            {page === "reports" && <Reports />}
            {page === "settings" && <Settings notify={notify} />}{" "}
            {drawer && (
              <Drawer
                lead={drawer}
                close={() => setDrawer(undefined)}
                refresh={() => setReload((x) => x + 1)}
                notify={notify}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
function Dashboard({ dash, leads }: { dash: any; leads: Lead[] }) {
  return (
    <>
      <section className="hero-row">
        <p className="muted">Resumo da operação comercial da Impulse Sites.</p>
        <a className="primary" href="#leads">
          ＋ Novo lead
        </a>
      </section>
      <section className="metrics">
        {[
          ["Leads", dash?.total],
          ["Novos", dash?.new],
          ["Contatados", dash?.contacted],
          ["Responderam", dash?.responded],
          ["Reuniões", dash?.meetings],
          ["Clientes", dash?.clients],
        ].map((x) => (
          <div className="metric" key={x[0]}>
            <span>{x[0]}</span>
            <strong>{x[1] || 0}</strong>
            <small>dados atuais</small>
          </div>
        ))}
      </section>
      <section className="panel followup-strip">
        <div>
          <span className="eyebrow">FOLLOW-UPS DE HOJE</span>
          <strong>{dash?.followUps?.today?.length || 0}</strong>
        </div>
        <div>
          <span className="eyebrow">ATRASADOS</span>
          <strong className="status-warn">
            {dash?.followUps?.overdue?.length || 0}
          </strong>
        </div>
        <div>
          <span className="eyebrow">PRÓXIMOS</span>
          <strong>{dash?.followUps?.upcoming?.length || 0}</strong>
        </div>
      </section>
      <section className="panel status-panel dashboard-status">
        <span className="eyebrow">STATUS DA OPERAÇÃO</span>
        <h2>{dash?.integration?.provider || "Meta Cloud API"}</h2>
        <p
          className={
            dash?.integration?.queuePaused ? "status-warn" : "status-ok"
          }
        >
          {dash?.integration?.queuePaused
            ? "Envios pausados preventivamente"
            : "Fila operacional"}{" "}
          · {dash?.integration?.testMode ? "SIMULAÇÃO · TEST_MODE" : "REAL"}
        </p>
        <small>
          Último webhook: {dash?.integration?.lastWebhook || "Nenhum evento"}
        </small>
      </section>
      <div className="grid-2">
        <section className="panel">
          <div className="panel-title">
            <span className="eyebrow">FUNIL COMERCIAL</span>
            <h2>Conversão por etapa</h2>
          </div>
          <div className="bars">
            {(dash?.pipeline || []).map((x: any) => (
              <div className="bar-row" key={x.status}>
                <span>{labels[x.status] || x.status}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.min(100, (x.count / (dash?.total || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <b>{x.count}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <span className="eyebrow">ATIVIDADE RECENTE</span>
            <h2>Últimos acontecimentos</h2>
          </div>
          <div className="activity">
            {(dash?.recent || []).slice(0, 7).map((x: any) => (
              <div className="activity-row" key={x.id}>
                <span className="activity-icon">·</span>
                <div>
                  <b>{x.type.replaceAll("_", " ")}</b>
                  <small>{new Date(x.createdAt).toLocaleString("pt-BR")}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel table-panel">
        <div className="panel-title">
          <span className="eyebrow">PRÓXIMA AÇÃO</span>
          <h2>Leads para trabalhar</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>LEAD</th>
              <th>EMPRESA</th>
              <th>ETAPA</th>
              <th>CONSENTIMENTO</th>
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 7).map((l) => (
              <tr key={l.id}>
                <td>
                  <b>{l.name}</b>
                  <small>{l.phone || "Sem telefone"}</small>
                </td>
                <td>{l.company || "—"}</td>
                <td>
                  <span className="pill">{labels[l.status] || l.status}</span>
                </td>
                <td>{l.consentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
function Leads({
  leads,
  open,
  refresh,
  notify,
}: {
  leads: Lead[];
  open: (l: Lead) => void;
  refresh: () => void;
  notify: (t: ToastState) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Lead>();
  const filtered = leads.filter(
    (l) =>
      (!status || l.status === status) &&
      [l.name, l.company, l.phone, l.city, l.niche, l.instagram].some((v) =>
        v?.toLowerCase().includes(q.toLowerCase()),
      ),
  );
  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      const d: any = await post(
        "/api/leads",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      notify(
        d.duplicate
          ? {
              kind: "warning",
              title: "Lead duplicado",
              description: d.duplicate.message,
            }
          : {
              kind: "success",
              title: "Lead criado",
              description: "Salvo no backend.",
            },
      );
      setModal(false);
      refresh();
    } catch (e: any) {
      notify({
        kind: "error",
        title: "Não foi possível criar",
        description: e.message,
      });
    } finally {
      setBusy(false);
    }
  };
  const destroy = async () => {
    if (!remove) return;
    try {
      await del(`/api/leads/${remove.id}`);
      notify({
        kind: "success",
        title: "Lead excluído",
        description: "Remoção confirmada pelo backend.",
      });
      setRemove(undefined);
      refresh();
    } catch (e: any) {
      notify({
        kind: "error",
        title: "Falha ao excluir lead",
        description: e.message,
      });
    }
  };
  return (
    <>
      <section className="hero-row">
        <p className="muted">
          Busca, filtros, consentimento e ações rápidas em um só lugar.
        </p>
        <button className="primary" onClick={() => setModal(true)}>
          ＋ Novo lead
        </button>
      </section>
      <div className="toolbar">
        <input
          className="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nome, empresa, telefone, cidade..."
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(labels).map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          className="ghost"
          onClick={() => {
            setQ("");
            setStatus("");
          }}
        >
          Limpar filtros
        </button>
        <LeadImport refresh={refresh} notify={notify} />
        <button
          className="ghost"
          onClick={() => {
            location.href = "/api/leads/export?format=csv";
            notify({ kind: "info", title: "Exportação iniciada" });
          }}
        >
          Exportar CSV
        </button>
      </div>
      <section className="panel table-panel">
        <div className="table-head">
          <b>{filtered.length} leads encontrados</b>
          <span className="muted">Clique para abrir detalhes</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>LEAD</th>
              <th>EMPRESA</th>
              <th>TELEFONE</th>
              <th>CIDADE</th>
              <th>NICHO</th>
              <th>STATUS</th>
              <th>CONSENTIMENTO</th>
              <th>RESPONSÁVEL</th>
              <th>ÚLTIMA ATIVIDADE</th>
              <th>AÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} onClick={() => open(l)}>
                <td>
                  <b>{l.name}</b>
                  <small>{l.instagram || "—"}</small>
                </td>
                <td>{l.company || "—"}</td>
                <td>{l.phone || "—"}</td>
                <td>{l.city || "—"}</td>
                <td>{l.niche || "—"}</td>
                <td>
                  <span className="pill">{labels[l.status] || l.status}</span>
                </td>
                <td
                  className={
                    l.consentStatus === "OPTED_OUT"
                      ? "status-warn"
                      : "status-ok"
                  }
                >
                  {l.consentStatus}
                </td>
                <td>{l.assignedUserId || "Não atribuído"}</td>
                <td>
                  {l.updatedAt
                    ? new Date(l.updatedAt).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
                <td>
                  <button
                    className="table-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      open(l);
                    }}
                  >
                    Abrir
                  </button>
                  <a
                    className="table-action"
                    href="#conversations"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Conversa
                  </a>
                  <a
                    className="table-action"
                    href="#tasks"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Tarefa
                  </a>
                  <button
                    className="table-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemove(l);
                    }}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <Empty
            title="Nenhum lead encontrado"
            text="Ajuste a busca ou crie o primeiro lead."
            action="Novo lead"
            onAction={() => setModal(true)}
          />
        )}
      </section>
      {modal && (
        <Modal title="Novo lead" onClose={() => setModal(false)}>
          <form className="form-grid" onSubmit={create}>
            <label>
              Nome
              <input name="name" required autoFocus />
            </label>
            <label>
              Empresa
              <input name="company" />
            </label>
            <label>
              Telefone
              <input name="phone" />
            </label>
            <label>
              Cidade
              <input name="city" />
            </label>
            <label>
              Estado
              <input name="state" />
            </label>
            <label>
              Nicho
              <input name="niche" />
            </label>
            <label className="wide">
              Observações
              <textarea name="observations" />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Salvando…" : "Salvar lead"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal title="Excluir lead" onClose={() => setRemove(undefined)}>
          <p className="hint">
            Esta ação remove o lead, histórico, mensagens e tarefas
            relacionadas.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setRemove(undefined)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => void destroy()}
            >
              Confirmar exclusão
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Drawer({
  lead,
  close,
  refresh,
  notify,
}: {
  lead: Lead;
  close: () => void;
  refresh: () => void;
  notify: (t: ToastState) => void;
}) {
  const [tab, setTab] = useState("overview");
  const [timeline, setTimeline] = useState<any>();
  const [note, setNote] = useState(false);
  const [edit, setEdit] = useState(false);
  const update = async (p: Partial<Lead>) => {
    try {
      await patch(`/api/leads/${lead.id}`, p);
      notify({
        kind: "success",
        title: "Lead atualizado",
        description: "Backend confirmou a alteração.",
      });
      refresh();
    } catch (e: any) {
      notify({
        kind: "error",
        title: "Falha ao atualizar",
        description: e.message,
      });
    }
  };
  useEffect(() => {
    get(`/api/leads/${lead.id}/timeline`).then(setTimeline);
  }, [lead.id]);
  const saveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const value = Object.fromEntries(new FormData(e.currentTarget));
      await patch(`/api/leads/${lead.id}`, {
        name: String(value.name),
        company: String(value.company || ""),
        city: String(value.city || ""),
        niche: String(value.niche || ""),
        nextFollowUpAt: value.nextFollowUpAt
          ? new Date(String(value.nextFollowUpAt)).toISOString()
          : undefined,
        lastContactAt: value.lastContactAt
          ? new Date(String(value.lastContactAt)).toISOString()
          : undefined,
        siteModelSent: String(value.siteModelSent || ""),
        proposedValue: value.proposedValue
          ? Number(value.proposedValue)
          : undefined,
        proposalDate: value.proposalDate
          ? new Date(String(value.proposalDate)).toISOString()
          : undefined,
      });
      notify({
        kind: "success",
        title: "Lead editado",
        description: "Alterações confirmadas pelo backend.",
      });
      setEdit(false);
      refresh();
    } catch (e: any) {
      notify({
        kind: "error",
        title: "Falha ao editar",
        description: e.message,
      });
    }
  };
  const addNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await post(`/api/leads/${lead.id}/notes`, {
        body: new FormData(e.currentTarget).get("body"),
      });
      notify({ kind: "success", title: "Nota adicionada" });
      setNote(false);
      get(`/api/leads/${lead.id}/timeline`).then(setTimeline);
    } catch (e: any) {
      notify({ kind: "error", title: "Falha na nota", description: e.message });
    }
  };
  return (
    <div className="drawer-backdrop" onClick={close}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>
          ×
        </button>
        <span className="eyebrow">DETALHE DO LEAD</span>
        <h2>{lead.name}</h2>
        <p className="muted">
          {lead.company || "Sem empresa"} · {lead.city || "Sem cidade"}
        </p>
        <div className="quick-actions">
          <button className="ghost" onClick={() => setEdit(true)}>
            Editar
          </button>
          <button
            className="ghost"
            onClick={() =>
              update({
                lastContactAt: new Date().toISOString(),
                status: "CONTATADO",
              })
            }
          >
            Registrar contato
          </button>
          <a className="primary" href="#conversations">
            Conversa
          </a>
          <button className="ghost" onClick={() => setNote(true)}>
            ＋ Nota
          </button>
          <a className="ghost" href="#tasks">
            ＋ Tarefa
          </a>
        </div>
        <div className="drawer-tabs">
          {[
            ["overview", "Visão geral"],
            ["activity", "Atividade"],
            ["consent", "Consentimento"],
            ["conversation", "Conversas"],
            ["tasks", "Tarefas"],
          ].map((x) => (
            <button
              className={tab === x[0] ? "selected" : ""}
              onClick={() => setTab(x[0])}
              key={x[0]}
            >
              {x[1]}
            </button>
          ))}
        </div>
        {tab === "overview" && (
          <>
            <div className="drawer-section">
              <label>STATUS</label>
              <select
                value={lead.status}
                onChange={(e) => update({ status: e.target.value })}
              >
                {Object.entries(labels).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="drawer-section">
              <label>CONTATO</label>
              <b>{lead.phone || "Sem telefone"}</b>
              <b>{lead.instagram || "Sem Instagram"}</b>
              <b>{lead.site || "Sem site"}</b>
              <b>Responsável: {lead.assignedUserId || "Não atribuído"}</b>
            </div>
            <div className="drawer-section">
              <label>VENDA / FOLLOW-UP</label>
              <b>
                Próximo follow-up:{" "}
                {lead.nextFollowUpAt
                  ? new Date(lead.nextFollowUpAt).toLocaleString("pt-BR")
                  : "Não definido"}
              </b>
              <b>
                Último contato:{" "}
                {lead.lastContactAt
                  ? new Date(lead.lastContactAt).toLocaleString("pt-BR")
                  : "Não registrado"}
              </b>
              <b>Modelo enviado: {lead.siteModelSent || "Nenhum"}</b>
              <b>
                Valor proposto:{" "}
                {lead.proposedValue
                  ? `R$ ${lead.proposedValue.toLocaleString("pt-BR")}`
                  : "Não informado"}
              </b>
            </div>
          </>
        )}
        {tab === "consent" && (
          <div className="drawer-section">
            <label>CONSENTIMENTO</label>
            <b
              className={
                lead.consentStatus === "OPTED_IN" ? "status-ok" : "status-warn"
              }
            >
              {lead.consentStatus}
            </b>
            <button
              className="ghost"
              onClick={() => update({ consentStatus: "OPTED_IN" })}
            >
              Registrar opt-in
            </button>
            <button
              className="danger"
              onClick={() =>
                update({ consentStatus: "OPTED_OUT", status: "NAO_CONTATAR" })
              }
            >
              Registrar opt-out
            </button>
          </div>
        )}
        {tab === "conversation" && (
          <div className="drawer-section">
            <label>CONVERSAS</label>
            <p className="muted">
              Abra a inbox para consultar e enviar mensagens de teste para este
              contato.
            </p>
            <a className="primary" href="#conversations">
              Abrir conversa
            </a>
          </div>
        )}
        {tab === "tasks" && (
          <div className="drawer-section">
            <label>TAREFAS</label>
            <p className="muted">
              Crie e acompanhe tarefas associadas a este lead.
            </p>
            <a className="primary" href="#tasks">
              Abrir tarefas
            </a>
          </div>
        )}
        {tab === "activity" && (
          <div className="timeline">
            {(timeline?.history || [])
              .slice()
              .reverse()
              .map((h: any) => (
                <div className="timeline-item" key={h.id}>
                  <b>{h.type.replaceAll("_", " ")}</b>
                  <span>{h.details || "Evento registrado"}</span>
                  <small>{new Date(h.createdAt).toLocaleString("pt-BR")}</small>
                </div>
              ))}
          </div>
        )}
        {edit && (
          <Modal title="Editar lead" onClose={() => setEdit(false)}>
            <form onSubmit={saveEdit}>
              <label>
                Nome
                <input
                  name="name"
                  defaultValue={lead.name}
                  required
                  autoFocus
                />
              </label>
              <label>
                Empresa
                <input name="company" defaultValue={lead.company} />
              </label>
              <label>
                Cidade
                <input name="city" defaultValue={lead.city} />
              </label>
              <label>
                Nicho
                <input name="niche" defaultValue={lead.niche} />
              </label>
              <label>
                Próximo follow-up
                <input
                  name="nextFollowUpAt"
                  type="datetime-local"
                  defaultValue={lead.nextFollowUpAt?.slice(0, 16)}
                />
              </label>
              <label>
                Último contato
                <input
                  name="lastContactAt"
                  type="datetime-local"
                  defaultValue={lead.lastContactAt?.slice(0, 16)}
                />
              </label>
              <label>
                Modelo enviado
                <input name="siteModelSent" defaultValue={lead.siteModelSent} />
              </label>
              <label>
                Valor proposto
                <input
                  name="proposedValue"
                  type="number"
                  step="0.01"
                  defaultValue={lead.proposedValue}
                />
              </label>
              <label>
                Data da proposta
                <input
                  name="proposalDate"
                  type="date"
                  defaultValue={lead.proposalDate?.slice(0, 10)}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setEdit(false)}
                >
                  Cancelar
                </button>
                <button className="primary">Salvar alterações</button>
              </div>
            </form>
          </Modal>
        )}
        {note && (
          <Modal title="Adicionar nota" onClose={() => setNote(false)}>
            <form onSubmit={addNote}>
              <label>
                Nota
                <textarea name="body" required autoFocus />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setNote(false)}
                >
                  Cancelar
                </button>
                <button className="primary">Salvar nota</button>
              </div>
            </form>
          </Modal>
        )}
      </aside>
    </div>
  );
}
function Pipeline({
  leads,
  refresh,
  notify,
}: {
  leads: Lead[];
  refresh: () => void;
  notify: (t: ToastState) => void;
}) {
  const move = async (id: string, status: string) => {
    try {
      await patch(`/api/leads/${id}`, { status });
      notify({ kind: "success", title: "Etapa atualizada" });
      refresh();
    } catch (e: any) {
      notify({
        kind: "error",
        title: "Movimento revertido",
        description: e.message,
      });
    }
  };
  return (
    <section className="kanban">
      {[
        "NOVO",
        "PESQUISADO",
        "CONTATADO",
        "RESPONDEU",
        "INTERESSADO",
        "REUNIAO",
        "PROPOSTA",
        "CLIENTE",
      ].map((status) => (
        <div
          className="kanban-col"
          key={status}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("lead");
            if (id) move(id, status);
          }}
        >
          <div className="col-head">
            <b>{labels[status]}</b>
            <span>{leads.filter((l) => l.status === status).length}</span>
          </div>
          {leads
            .filter((l) => l.status === status)
            .map((l) => (
              <div
                className="lead-card"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("lead", l.id)}
                key={l.id}
              >
                <b>{l.company || l.name}</b>
                <small>
                  {l.name} · {l.phone || "sem telefone"}
                </small>
                <span>
                  {l.city || "—"} · {l.niche || "Sem nicho"}
                </span>
              </div>
            ))}
        </div>
      ))}
    </section>
  );
}
import { Conversations } from "./pages/Conversations";
import { Campaigns } from "./pages/Campaigns";
import { Templates } from "./pages/Templates";
import { Tasks } from "./pages/Tasks";
import { Quality } from "./pages/Quality";
import { Settings } from "./pages/Settings";
function ProspectingOverview() {
  const [data, setData] = useState<any>();
  useEffect(() => {
    get("/api/prospecting/overview").then(setData);
  }, []);
  return (
    <>
      <section className="hero-row">
        <p className="muted">
          Resumo das oportunidades digitais encontradas pela Impulse Radar.
        </p>
        <a className="primary" href="#prospecting">
          ＋ Buscar layouts
        </a>
      </section>
      <section className="metrics">
        {[
          ["Layouts encontrados", data?.total],
          ["Layouts salvos", data?.saved],
          ["Sem site", data?.noWebsite],
          ["Só rede social", data?.socialOnly],
          ["Com site", data?.website],
          ["Score médio", data?.averageScore],
          ["Sem ação", data?.commercial?.NOVO],
          ["Para abordar", data?.commercial?.PARA_ABORDAR],
          ["Abordados", data?.commercial?.ABORDADO],
          ["Interessados", data?.commercial?.INTERESSADO],
          ["Propostas", data?.commercial?.PROPOSTA],
          ["Fechados", data?.commercial?.FECHADO],
        ].map((item) => (
          <div className="metric" key={item[0]}>
            <span>{item[0]}</span>
            <strong>{item[1] || 0}</strong>
            <small>dados da prospecção</small>
          </div>
        ))}
      </section>
      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">BUSCAS RECENTES</span>
            <h2>Últimas pesquisas</h2>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>LOCAL</th>
              <th>NICHO</th>
              <th>NÍVEL</th>
              <th>ENCONTRADOS</th>
              <th>DATA</th>
            </tr>
          </thead>
          <tbody>
            {(data?.recentSearches || []).map((item: any) => (
              <tr key={item.id}>
                <td>
                  <b>{item.city}</b>
                  <small>{item.state}</small>
                </td>
                <td>{item.niche}</td>
                <td>{searchModeLabel(item.sourceMode)}</td>
                <td>
                  {item.resultsCount} / {item.quantity}
                </td>
                <td>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.recentSearches?.length && (
          <div className="empty">
            <h2>Faça a primeira busca de layouts.</h2>
          </div>
        )}
      </section>
    </>
  );
}
function ProspectingMap() {
  const [data, setData] = useState<any>();
  useEffect(() => {
    get("/api/prospecting/overview").then(setData);
  }, []);
  return (
    <>
      <section className="hero-row">
        <p className="muted">
          Distribuição real das oportunidades descobertas no Brasil.
        </p>
      </section>
      <section className="metrics">
        {[
          ["Layouts encontrados", data?.total],
          ["Salvos", data?.saved],
          ["Sem site", data?.noWebsite],
          ["Só rede social", data?.socialOnly],
          ["Com site", data?.website],
          ["Score médio", data?.averageScore],
        ].map((item) => (
          <div className="metric" key={item[0]}>
            <span>{item[0]}</span>
            <strong>{item[1] || 0}</strong>
            <small>dados do sistema</small>
          </div>
        ))}
      </section>
      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">MAPA NACIONAL</span>
            <h2>Estados pesquisados</h2>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ESTADO</th>
              <th>TOTAL</th>
              <th>SEM SITE</th>
              <th>SOCIAL</th>
              <th>COM SITE</th>
              <th>SCORE MÉDIO</th>
            </tr>
          </thead>
          <tbody>
            {(data?.byState || []).map((item: any) => (
              <tr key={item.state}>
                <td>
                  <b>{item.state}</b>
                </td>
                <td>{item.total}</td>
                <td>{item.noWebsite}</td>
                <td>{item.socialOnly}</td>
                <td>{item.website}</td>
                <td>{item.averageScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.byState?.length && (
          <div className="empty">
            <h2>O mapa será preenchido após a primeira busca.</h2>
          </div>
        )}
      </section>
    </>
  );
}
function SearchHistory() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    get<any>("/api/prospecting/searches").then((result) =>
      setData(result.data),
    );
  }, []);
  const remove = async (id: string) => {
    if (!window.confirm("Excluir esta busca e seus resultados?")) return;
    await del(`/api/prospecting/searches/${id}`);
    setData((items) => items.filter((item) => item.id !== id));
  };
  return (
    <>
      <section className="hero-row">
        <p className="muted">
          Buscas persistidas e resultados que podem ser reabertos.
        </p>
      </section>
      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              <th>DATA</th>
              <th>LOCAL</th>
              <th>NICHO</th>
              <th>NÍVEL</th>
              <th>QUANTIDADE</th>
              <th>RESULTADOS</th>
              <th>STATUS</th>
              <th>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                <td>
                  {item.city} · {item.state}
                </td>
                <td>{item.niche}</td>
                <td>{searchModeLabel(item.sourceMode)}</td>
                <td>{item.quantity}</td>
                <td>{item.resultsCount}</td>
                <td>{searchStatusLabel(item.status)}</td>
                <td>
                  <button
                    className="table-action"
                    onClick={() => {
                      sessionStorage.setItem("impulse.reopenSearchId", item.id);
                      location.hash = "prospecting";
                    }}
                  >
                    Ver resultados
                  </button>
                  {["FAILED", "INTERRUPTED"].includes(item.status) && (
                    <button
                      className="table-action"
                      onClick={() =>
                        void post<any>(
                          `/api/prospecting/searches/${item.id}/retry`,
                        ).then((result) => {
                          sessionStorage.setItem(
                            "impulse.reopenSearchId",
                            result.data.id,
                          );
                          location.hash = "prospecting";
                        })
                      }
                    >
                      Tentar novamente
                    </button>
                  )}
                  {!['QUEUED', 'RUNNING'].includes(item.status) && (
                    <button
                      className="table-action"
                      onClick={() => void remove(item.id)}
                    >
                      Excluir histórico
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && (
          <div className="empty">
            <h2>Nenhuma busca registrada.</h2>
          </div>
        )}
      </section>
    </>
  );
}
function Integrations() {
  const integrations = [
    [
      "Google Places",
      "Não configurado",
      "Dados oficiais de negócio, telefone, avaliação e coordenadas.",
      "Requer GOOGLE_PLACES_API_KEY.",
    ],
    [
      "OpenStreetMap",
      "Disponível",
      "Geocodificação e cobertura pública de mapas.",
      "Nominatim/tiles públicos com limites de uso.",
    ],
    [
      "Busca Web",
      "Não configurado",
      "Descoberta complementar de presença digital pública.",
      "Requer SEARCH_PROVIDER_API_KEY.",
    ],
    [
      "Social Discovery",
      "Somente público",
      "Links públicos de redes sociais.",
      "Não acessa sessões privadas.",
    ],
    [
      "Map Tiles",
      "Disponível",
      "Ruas, marcadores, clusters e enquadramento.",
      "OpenStreetMap raster tiles.",
    ],
  ];
  return (
    <>
      <section className="hero-row">
        <p className="muted">
          Fontes públicas e oficiais disponíveis para a descoberta.
        </p>
      </section>
      <section className="metrics">
        {integrations.map((item) => (
          <div className="metric" key={item[0]}>
            <span>{item[0]}</span>
            <strong className="integration-status">{item[1]}</strong>
            <small>{item[2]}</small>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Capacidade e configuração</h2>
        {integrations.map((item) => (
          <p className="muted" key={item[0]}>
            <b>{item[0]}:</b> {item[3]}
          </p>
        ))}
        <p className="muted">
          O sistema usa apenas APIs oficiais e dados públicos; não automatiza
          login, scraping de sessões privadas, CAPTCHA ou evasão de limites.
        </p>
      </section>
    </>
  );
}
function Account() {
  const defaults = {
    agencyName: "Impulse Radar",
    portfolioUrl: "",
    defaultQuantity: "20",
    defaultScore: "0",
    defaultLevel: "ALTO",
    defaultCoverage: "INTELLIGENT",
    proposalValue: "",
    proposalDeadline: "15",
  };
  const [values, setValues] = useState(() => ({
    ...defaults,
    ...JSON.parse(localStorage.getItem("impulse.account") || "{}"),
  }));
  const save = (key: string, value: string) =>
    setValues((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem("impulse.account", JSON.stringify(next));
      return next;
    });
  return (
    <>
      <section className="hero-row">
        <p className="muted">Preferências e segurança da sua conta.</p>
      </section>
      <section className="panel form-grid">
        <span className="eyebrow">CONTA ATUAL</span>
        <h2>Minha conta</h2>
        <label>
          Nome da agência
          <input
            value={values.agencyName}
            onChange={(e) => save("agencyName", e.target.value)}
          />
        </label>
        <label>
          URL do portfólio
          <input
            type="url"
            value={values.portfolioUrl}
            onChange={(e) => save("portfolioUrl", e.target.value)}
          />
        </label>
        <label>
          Quantidade padrão
          <input
            type="number"
            min="5"
            max="500"
            value={values.defaultQuantity}
            onChange={(e) => save("defaultQuantity", e.target.value)}
          />
        </label>
        <label>
          Score mínimo padrão
          <select
            value={values.defaultScore}
            onChange={(e) => save("defaultScore", e.target.value)}
          >
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Nível padrão
          <select
            value={values.defaultLevel}
            onChange={(e) => save("defaultLevel", e.target.value)}
          >
            <option value="FRACO">Fraco</option>
            <option value="MEDIO">Médio</option>
            <option value="ALTO">Alto</option>
            <option value="ULTRA">Ultra</option>
          </select>
        </label>
        <label>
          Cobertura padrão
          <select
            value={values.defaultCoverage}
            onChange={(e) => save("defaultCoverage", e.target.value)}
          >
            <option value="STRICT">Estrita</option>
            <option value="INTELLIGENT">Inteligente</option>
            <option value="BROAD">Ampla</option>
          </select>
        </label>
        <label>
          Valor padrão da proposta
          <input
            value={values.proposalValue}
            onChange={(e) => save("proposalValue", e.target.value)}
            placeholder="R$"
          />
        </label>
        <label>
          Prazo padrão (dias)
          <input
            type="number"
            value={values.proposalDeadline}
            onChange={(e) => save("proposalDeadline", e.target.value)}
          />
        </label>
        <p className="muted wide">
          A autenticação e o controle de acesso continuam protegidos pelo
          backend.
        </p>
      </section>
    </>
  );
}
function Empty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">◇</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && onAction && (
        <button className="ghost" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("admin@impulsesites.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await post("/api/auth/login", { email, password });
      onLogin();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <form onSubmit={submit}>
        <span className="eyebrow">IMPULSE CONNECT</span>
        <h2>Entrar na operação</h2>
        <label>
          E-mail
          <input
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Senha
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="status-warn">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error?: Error }
> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <div className="loading-screen">
        <h2>Erro ao renderizar</h2>
        <p>{this.state.error.message}</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
function AuthGate() {
  const [auth, setAuth] = useState<boolean | null>(null);
  useEffect(() => {
    get("/api/dashboard")
      .then(() => setAuth(true))
      .catch(() => setAuth(false));
  }, []);
  return auth === null ? (
    <div className="loading-screen">Carregando operação…</div>
  ) : auth ? (
    <App />
  ) : (
    <Login onLogin={() => setAuth(true)} />
  );
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AuthGate />
  </ErrorBoundary>,
);
