import React, { useCallback, useEffect, useState } from 'react';
import { get } from '../services/api';
import { ToastState } from '../components/Toast';

function State({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <div className="panel loading-state">Carregando monitor de qualidade…</div>;
  if (error) return <div className="panel error-state"><h3>Não foi possível carregar a qualidade</h3><p>{error}</p><button className="primary" onClick={retry}>Tentar novamente</button></div>;
  return null;
}

export function Quality({ notify }: { notify?: (t: ToastState) => void }) {
  const [d, setD] = useState<any>(); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setD(await get('/api/quality')); } catch (e: any) { setError(e.message || 'Erro inesperado'); notify?.({ kind: 'error', title: 'Qualidade indisponível', description: e.message }); } finally { setLoading(false); } }, [notify]);
  useEffect(() => { load(); }, [load]);
  const metric = (label: string, value: any) => <div className="metric" key={label}><span>{label}</span><strong>{value ?? 0}</strong><small>estado atual</small></div>;
  return <><State loading={loading} error={error} retry={load} />{!loading && !error && <><section className="metrics">{[metric('Enviadas', d?.sent), metric('Entregues', d?.delivered), metric('Lidas', d?.read), metric('Falhas', d?.failed), metric('Opt-outs', d?.optOuts), metric('Fila', d?.integration?.queuePaused ? 'Pausada' : 'Operacional')]}</section><section className="panel status-panel"><span className="eyebrow">STATUS GERAL</span><h2>Meta Cloud API · {d?.integration?.testMode ? 'SIMULAÇÃO · TEST_MODE' : 'REAL'}</h2><div className="detail-grid"><div><small>TAXA DE ENTREGA</small><b>{d?.deliveryRate ? `${(d.deliveryRate * 100).toFixed(1)}%` : '0%'}</b></div><div><small>TAXA DE FALHA</small><b>{d?.sent ? `${((d.failed / d.sent) * 100).toFixed(1)}%` : '0%'}</b></div><div><small>FILA</small><b>{d?.integration?.queuePaused ? 'PAUSADA' : 'OPERACIONAL'}</b></div><div><small>WEBHOOK</small><b>{d?.lastWebhook || 'Nenhum evento'}</b></div></div><p className="muted">Provider oficial: {d?.integration?.provider || 'Meta WhatsApp Cloud API'} · Falhas recentes: {d?.recentErrors?.length || 0} · Dead letters: {d?.deadLetters?.length || 0}</p></section></>}</>;
}

export function Reports({ notify }: { notify?: (t: ToastState) => void }) {
  const [d, setD] = useState<any>(); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setD(await get('/api/reports')); } catch (e: any) { setError(e.message || 'Erro inesperado'); notify?.({ kind: 'error', title: 'Relatório indisponível', description: e.message }); } finally { setLoading(false); } }, [notify]);
  useEffect(() => { load(); }, [load]);
  return <><State loading={loading} error={error} retry={load} />{!loading && !error && <section className="panel live-module"><span className="eyebrow">RELATÓRIO OPERACIONAL</span><h2>Atividade por dia</h2>{Object.entries(d?.activityByDay || {}).map(([day, count]) => <div className="report-row" key={day}><b>{day}</b><span>{String(count)} eventos</span></div>)}{!Object.keys(d?.activityByDay || {}).length && <div className="empty-state"><h3>Sem atividade no período</h3><p>Os eventos aparecerão quando houver movimentação.</p></div>}</section>}</>;
}
