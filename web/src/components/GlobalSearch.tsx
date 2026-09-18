import React, { useEffect, useState } from 'react';
import { get } from '../services/api';
import { Lead } from '../types';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const value = query.trim();
    if (!value) { setResults([]); setError(''); return; }
    const timer = window.setTimeout(() => { setLoading(true); setError(''); get<{ data: Lead[] }>('/api/leads', { search: value, limit: '8' }).then((response) => setResults(response.data)).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false)); }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);
  const open = (lead: Lead) => { sessionStorage.setItem('impulse.openLeadId', lead.id); location.hash = '#leads'; location.reload(); };
  return <div className="global-search"><label htmlFor="global-lead-search">Busca rápida</label><input id="global-lead-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, empresa, telefone, Instagram ou cidade" aria-label="Buscar leads no CRM" />{query.trim() && <div className="search-results" role="listbox">{loading && <span className="search-state">Buscando…</span>}{error && <span className="search-state status-warn">Não foi possível buscar: {error}</span>}{!loading && !error && !results.length && <span className="search-state">Nenhum lead encontrado.</span>}{results.map((lead) => <button type="button" key={lead.id} onClick={() => open(lead)}><b>{lead.name}</b><span>{lead.company || 'Sem empresa'} · {lead.city || 'Sem cidade'}</span></button>)}</div>}</div>;
}
