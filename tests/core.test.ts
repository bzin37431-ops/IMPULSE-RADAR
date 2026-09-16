import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryStore } from '../src/store.js';
import { normalizePhone, can } from '../src/domain.js';
import { OfficialApiGuard } from '../src/providers/whatsapp/index.js';
import { CircuitBreaker } from '../src/queue.js';
import { env } from '../src/config.js';

test('normaliza telefones brasileiros para E.164', () => assert.equal(normalizePhone('(11) 98765-4321'), '+5511987654321'));
test('detecta duplicados por telefone', () => { const s = new MemoryStore(); const first = s.createLead({ name: 'Clínica X', phone: '11987654321' }); assert.ok(first.lead); assert.equal(s.createLead({ name: 'Outra', phone: '+55 11 98765-4321' }).duplicate?.id, first.lead.id); });
test('opt-out muda etapa', () => { const s = new MemoryStore(); const { lead } = s.createLead({ name: 'Lead', phone: '11900000000' }); const updated = s.updateLead(lead!.id, { consentStatus: 'OPTED_OUT', status: 'NAO_CONTATAR' }); assert.equal(updated?.status, 'NAO_CONTATAR'); assert.equal(updated?.consentStatus, 'OPTED_OUT'); });
test('perfis respeitam permissoes', () => { assert.equal(can('VIEWER', 'read'), true); assert.equal(can('VIEWER', 'write'), false); assert.equal(can('AGENT', 'send'), true); assert.equal(can('MANAGER', 'campaign'), true); });
test('guard rejeita provider alternativo', () => { const node = env.NODE_ENV; const provider = env.PROVIDER_MODE; const testMode = env.TEST_MODE; env.NODE_ENV = 'production'; env.PROVIDER_MODE = 'web'; env.TEST_MODE = false; assert.throws(() => new OfficialApiGuard(), /Production requires/); env.NODE_ENV = node; env.PROVIDER_MODE = provider; env.TEST_MODE = testMode; });
test('produção rejeita mock mesmo com provider oficial', () => { const node = env.NODE_ENV; const testMode = env.TEST_MODE; env.NODE_ENV = 'production'; env.TEST_MODE = true; assert.throws(() => new OfficialApiGuard(), /TEST_MODE/); env.NODE_ENV = node; env.TEST_MODE = testMode; });
test('circuit breaker pausa após taxa de falhas e pode ser rearmado', () => { const breaker = new CircuitBreaker(.5, 4); breaker.record(false); breaker.record(false); breaker.record(true); breaker.record(false); assert.equal(breaker.shouldPause(), true); breaker.reset(); assert.equal(breaker.paused, false); assert.equal(breaker.attempts, 0); });
