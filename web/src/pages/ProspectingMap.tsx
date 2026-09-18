import { useEffect, useMemo, useState } from "react";
import { get } from "../services/api";
import { OpportunityMap } from "../components/OpportunityMap";
import "../prospecting.css";
import "../radar-theme.css";

type MapItem = {
  id: string;
  name: string;
  city: string;
  state: string;
  category?: string;
  digitalStatus: string;
  opportunityScore: number;
  latitude?: number;
  longitude?: number;
  phone?: string;
};

export function ProspectingMap() {
  const [items, setItems] = useState<MapItem[]>([]),
    [state, setState] = useState(""),
    [city, setCity] = useState(""),
    [niche, setNiche] = useState(""),
    [selectedId, setSelectedId] = useState<string>();
  useEffect(() => {
    get<{ data: MapItem[] }>("/api/prospecting/businesses")
      .then((data) => setItems(data.data))
      .catch(() => setItems([]));
  }, []);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (!state || item.state === state) &&
          (!city || item.city.toLowerCase().includes(city.toLowerCase())) &&
          (!niche ||
            item.category?.toLowerCase().includes(niche.toLowerCase())),
      ),
    [items, state, city, niche],
  );
  const select = (id: string) => {
    setSelectedId(id);
    document
      .getElementById(`map-result-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  return (
    <section className="radar-map-page">
      <div className="map-filter-panel panel">
        <span className="eyebrow">MAPA</span>
        <h2>Mapa de layouts</h2>
        <label>
          Estado
          <input
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="Todos os estados"
          />
        </label>
        <label>
          Cidade
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Toda cidade"
          />
        </label>
        <label>
          Nicho
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Todos os nichos"
          />
        </label>
        <p className="muted">
          {filtered.length} layouts ·{" "}
          {filtered.filter((item) => item.latitude && item.longitude).length}{" "}
          coordenadas
        </p>
      </div>
      <div className="radar-map-stage">
        <OpportunityMap
          items={filtered.filter((item) => item.latitude && item.longitude)}
          selectedId={selectedId}
          onSelect={select}
        />
        {!filtered.filter((item) => item.latitude && item.longitude).length && (
          <div className="panel empty">
            <h2>Nenhuma coordenada disponível</h2>
            <p>
              Os resultados precisam de localização confirmada para aparecer no
              mapa.
            </p>
          </div>
        )}
        <div className="map-result-strip">
          {filtered.slice(0, 5).map((item) => (
            <button
              id={`map-result-${item.id}`}
              className={selectedId === item.id ? "selected" : ""}
              onClick={() => select(item.id)}
              key={item.id}
            >
              {item.name}
              <small>
                {item.city} · Score {item.opportunityScore}
              </small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
