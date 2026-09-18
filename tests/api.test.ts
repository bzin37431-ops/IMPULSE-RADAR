import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store.js';
import { env } from '../src/config.js';

test('API expõe health, CRUD de lead, duplicidade e opt-out', async () => {
  const store = new MemoryStore(true); const app = buildApp({ store });
  const health = await app.inject({ method: 'GET', url: '/health' }); assert.equal(health.statusCode, 200); assert.equal(health.json().api, 'ok');
  const created = await app.inject({ method: 'POST', url: '/api/leads', payload: { name: 'Clínica API', phone: '(11) 98888-7777', consentStatus: 'OPTED_IN', city: 'São Paulo' } });
  assert.equal(created.statusCode, 200); const lead = created.json().data; assert.equal(lead.normalizedPhone, '+5511988887777');
  const duplicate = await app.inject({ method: 'POST', url: '/api/leads', payload: { name: 'Outro nome', phone: '+55 11 98888-7777' } }); assert.equal(duplicate.json().duplicate.id, lead.id);
  const optout = await app.inject({ method: 'PATCH', url: `/api/leads/${lead.id}`, payload: { consentStatus: 'OPTED_OUT' } }); assert.equal(optout.json().data.status, 'NAO_CONTATAR');
  const blocked = await app.inject({ method: 'POST', url: `/api/conversations/${lead.id}/messages`, payload: { text: 'Olá' } }); assert.equal(blocked.statusCode, 400); assert.match(blocked.json().message, /não sejam enviadas/);
  await app.close();
});

test('webhook aceita evento em test mode e é idempotente', async () => {
  const store = new MemoryStore(true); const app = buildApp({ store });
  const created = await app.inject({ method: 'POST', url: '/api/leads', payload: { name: 'Webhook Lead', phone: '11911112222' } }); const id = created.json().data.id;
  const payload = { entry: [{ changes: [{ value: { messages: [{ id: 'meta-1', from: '5511911112222', text: { body: 'Oi' } }] } }] }] };
  const first = await app.inject({ method: 'POST', url: '/webhooks/whatsapp', payload }); const second = await app.inject({ method: 'POST', url: '/webhooks/whatsapp', payload });
  assert.equal(first.statusCode, 200); assert.equal(second.json().idempotent, true); assert.equal(store.leads.get(id)?.status, 'RESPONDEU');
  await app.close();
});

test('campanha exige aprovação manual e segmenta somente opt-in', async () => {
  const store = new MemoryStore(true); const app = buildApp({ store });
  const eligible = await app.inject({ method: 'POST', url: '/api/leads', payload: { name: 'Elegível', phone: '11922223333', consentStatus: 'OPTED_IN', city: 'São Paulo' } });
  await app.inject({ method: 'POST', url: '/api/leads', payload: { name: 'Sem consentimento', phone: '11933334444', city: 'São Paulo' } });
  const created = await app.inject({ method: 'POST', url: '/api/campaigns', payload: { name: 'Apresentação', templateName: 'impulse_apresentacao', segment: { city: 'São Paulo' } } });
  assert.equal(created.json().estimate.eligible, 1); const id = created.json().data.id;
  const blockedStart = await app.inject({ method: 'POST', url: `/api/campaigns/${id}/start`, payload: { confirm: true } }); assert.equal(blockedStart.statusCode, 400);
  const approved = await app.inject({ method: 'POST', url: `/api/campaigns/${id}/approve`, payload: { confirm: true } }); assert.equal(approved.json().data.status, 'SCHEDULED');
  await app.inject({ method: 'POST', url: '/api/settings/pause' }); const pausedStart = await app.inject({ method: 'POST', url: `/api/campaigns/${id}/start`, payload: { confirm: true } }); assert.equal(pausedStart.statusCode, 400); assert.equal(store.campaigns[0].status, 'SCHEDULED'); await app.inject({ method: 'POST', url: '/api/settings/resume', payload: { confirm: true } });
  const started = await app.inject({ method: 'POST', url: `/api/campaigns/${id}/start`, payload: { confirm: true } }); assert.equal(started.json().enqueued, 1); const pausedCampaign = await app.inject({ method: 'POST', url: `/api/campaigns/${id}/pause` }); assert.equal(pausedCampaign.json().data.status, 'PAUSED'); assert.ok(eligible.json().data.id);
  await app.close();
});

test('conversa mock simula inbound e atualiza a etapa do lead', async () => {
  const store = new MemoryStore(true); const app = buildApp({ store });
  const created = await app.inject({ method: 'POST', url: '/api/leads', payload: { name: 'Inbox mock', phone: '11944445555', consentStatus: 'OPTED_IN' } }); const id = created.json().data.id;
  const simulated = await app.inject({ method: 'POST', url: `/api/conversations/${id}/simulate-inbound`, payload: { text: 'Tenho interesse' } });
  assert.equal(simulated.statusCode, 200); assert.equal(simulated.json().simulation, true); assert.equal(store.leads.get(id)?.status, 'RESPONDEU');
  const messages = await app.inject({ method: 'GET', url: `/api/conversations/${id}/messages` }); assert.equal(messages.json().data[0].content, 'Tenho interesse');
  await app.close();
});

test('lead preserva dados comerciais e tarefa registra descricao e conclusao', async () => {
  const store = new MemoryStore(true); const app = buildApp({ store });
  const followUp = new Date(Date.now() + 86400000).toISOString();
  const created = await app.inject({ method: 'POST', url: '/api/leads', payload: { name: 'Dados comerciais', phone: '11955556666', nextFollowUpAt: followUp, lastContactAt: new Date().toISOString(), siteModelSent: 'Modelo Aurora', proposedValue: 3500, proposalDate: new Date().toISOString() } });
  assert.equal(created.statusCode, 200); const lead = created.json().data;
  assert.equal(lead.nextFollowUpAt, followUp); assert.equal(lead.siteModelSent, 'Modelo Aurora'); assert.equal(lead.proposedValue, 3500);
  const task = await app.inject({ method: 'POST', url: '/api/tasks', payload: { leadId: lead.id, title: 'Retornar proposta', description: 'Enviar a proposta revisada', assignedTo: 'aline', dueDate: followUp } });
  assert.equal(task.statusCode, 200); assert.equal(task.json().data.description, 'Enviar a proposta revisada');
  const completed = await app.inject({ method: 'PATCH', url: `/api/tasks/${task.json().data.id}`, payload: { completed: true } });
  assert.equal(completed.statusCode, 200); assert.equal(completed.json().data.completed, true); assert.ok(store.histories.some((item) => item.type === 'TASK_COMPLETED'));
  const dashboard = await app.inject({ method: 'GET', url: '/api/dashboard' }); assert.equal(dashboard.statusCode, 200); assert.equal(dashboard.json().followUps.upcoming.length, 1);
  await app.close();
});

test('produção exige JWT em cookie e não confia no header de role', async () => {
  const previous = { node: env.NODE_ENV, test: env.TEST_MODE, provider: env.PROVIDER_MODE, password: env.ADMIN_PASSWORD };
  env.NODE_ENV = 'production'; env.TEST_MODE = false; env.PROVIDER_MODE = 'meta-cloud-api'; env.ADMIN_PASSWORD = 'audit-password';
  const app = buildApp({ store: new MemoryStore(false) });
  const anonymous = await app.inject({ method: 'GET', url: '/api/dashboard', headers: { 'x-user-role': 'ADMIN' } }); assert.equal(anonymous.statusCode, 401);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: env.ADMIN_EMAIL, password: 'audit-password' } }); assert.equal(login.statusCode, 200); const cookie = login.headers['set-cookie']; assert.ok(cookie);
  const csrfBlocked = await app.inject({ method: 'POST', url: '/api/settings/pause', headers: { cookie: Array.isArray(cookie) ? cookie.join('; ') : cookie! } }); assert.equal(csrfBlocked.statusCode, 403);
  const csrf = Array.isArray(cookie) ? cookie.join('; ').match(/csrf=([^;]+)/)?.[1] : cookie!.match(/csrf=([^;]+)/)?.[1]; const authorized = await app.inject({ method: 'POST', url: '/api/settings/pause', headers: { cookie: Array.isArray(cookie) ? cookie.join('; ') : cookie!, 'x-csrf-token': csrf } }); assert.equal(authorized.statusCode, 200);
  await app.close(); Object.assign(env, { NODE_ENV: previous.node, TEST_MODE: previous.test, PROVIDER_MODE: previous.provider, ADMIN_PASSWORD: previous.password });
});
test('prospecting inicia busca mock, filtra e salva oportunidade como lead', async () => { const store = new MemoryStore(true); const app = buildApp({ store }); const created = await app.inject({ method:'POST', url:'/api/prospecting/searches', payload:{ state:'São Paulo', city:'São José dos Campos', niche:'Clínicas de estética', sourceMode:'AMPLIADA', digitalStatus:'NO_WEBSITE_FOUND', minScore:20, quantity:5, coverageMode:'INTELLIGENT' } }); assert.equal(created.statusCode, 200); const id=created.json().data.id; await new Promise((resolve)=>setTimeout(resolve,50)); const result=await app.inject({ method:'GET', url:`/api/prospecting/searches/${id}` }); assert.equal(result.statusCode,200); assert.equal(result.json().search.status,'COMPLETED'); assert.equal(result.json().search.progress,100); assert.ok(result.json().data.length > 0); const saved=await app.inject({method:'POST',url:`/api/prospecting/businesses/${result.json().data[0].id}/save-lead`}); assert.equal(saved.statusCode,200); assert.equal(store.leads.size,1); await app.close(); });
