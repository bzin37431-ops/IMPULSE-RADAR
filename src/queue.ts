import { Message } from './domain.js';
import { MemoryStore } from './store.js';
import { WhatsAppProvider, ProviderResult } from './providers/whatsapp/index.js';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './config.js';

export class CircuitBreaker {
  attempts = 0; failures = 0; paused = false;
  constructor(private threshold = .25, private minSamples = 4) {}
  record(success: boolean) { this.attempts++; if (!success) this.failures++; }
  shouldPause() { this.paused = this.attempts >= this.minSamples && this.failures / this.attempts >= this.threshold; return this.paused; }
  reset() { this.attempts = 0; this.failures = 0; this.paused = false; }
}

function isRetryable(result: ProviderResult) { return result.errorCode === '429' || result.errorCode?.startsWith('5') || result.errorCode === 'TEMPORARY'; }
function wait(ms: number) { return new Promise<void>((resolve) => setTimeout(resolve, ms)); }

type DeadLetter = { jobId: string; leadId: string; campaignId?: string; error?: string; attempts: number; failedAt: string };

export class SendQueue {
  private jobs: Message[] = []; private active = 0; readonly breaker = new CircuitBreaker(); private redisQueue?: Queue<Message>; private redisWorker?: Worker<Message>; private redisConnection?: Redis;
  constructor(private store: MemoryStore, private provider: WhatsAppProvider) { if (env.REDIS_URL) { const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }); this.redisConnection = connection; this.redisQueue = new Queue<Message>('impulse-whatsapp-send', { connection }); this.redisWorker = new Worker<Message>('impulse-whatsapp-send', async (job) => this.process(job.data), { connection, concurrency: store.settings.maxConcurrentRequests }); void connection.get('impulse:queue:paused').then((value) => { if (value === '1') { this.store.settings.queuePaused = true; return this.redisQueue?.pause(); } }).catch((error: unknown) => { this.store.settings.lastQueueError = error instanceof Error ? error.message : 'Redis indisponível'; }); void connection.lrange('impulse:queue:dead-letters', -20, -1).then((items) => { this.store.settings.deadLetters.push(...items.map((item) => JSON.parse(item) as DeadLetter)); }).catch((error: unknown) => { this.store.settings.lastQueueError = error instanceof Error ? error.message : 'Redis indisponível'; }); this.redisWorker.on('failed', (job, error) => { this.store.settings.lastQueueError = `${job?.id || 'job'}: ${error.message}`; }); } }
  enqueue(message: Message) { if (this.store.settings.queuePaused || this.breaker.paused) throw new Error('Envios pausados preventivamente.'); if (this.redisQueue) { void this.redisQueue.add('send', message, { jobId: message.id, attempts: this.store.settings.maxRetries + 1, backoff: { type: 'exponential', delay: this.store.settings.retryBackoff }, removeOnComplete: false, removeOnFail: false }); return message; } if (this.jobs.length >= this.store.settings.maxQueueSize) throw new Error('Fila de envio cheia.'); this.jobs.push(message); void this.drain(); return message; }
  async pause() { this.store.settings.queuePaused = true; if (this.redisConnection) await this.redisConnection.set('impulse:queue:paused', '1'); if (this.redisQueue) await this.redisQueue.pause(); }
  async resume() { this.store.settings.queuePaused = false; this.breaker.reset(); if (this.redisConnection) await this.redisConnection.del('impulse:queue:paused'); if (this.redisQueue) await this.redisQueue.resume(); }
  async close() { await this.redisWorker?.close(); await this.redisQueue?.close(); await this.redisConnection?.quit(); }
  private async drain() { while (this.jobs.length && this.active < this.store.settings.maxConcurrentRequests && !this.store.settings.queuePaused && !this.breaker.paused) { const job = this.jobs.shift()!; this.active++; void this.process(job).finally(() => { this.active--; void this.drain(); }); } }
  private async process(job: Message) {
    const to = this.store.leads.get(job.conversationId)?.normalizedPhone || ''; let result: ProviderResult | undefined;
    for (let attempt = 0; attempt <= this.store.settings.maxRetries; attempt++) {
      try { result = job.templateName ? await this.provider.sendTemplate({ to, templateName: job.templateName, idempotencyKey: job.idempotencyKey }) : await this.provider.sendText({ to, text: job.content, idempotencyKey: job.idempotencyKey }); }
      catch (error) { result = { providerMessageId: '', status: 'FAILED', errorCode: 'TEMPORARY', errorMessage: error instanceof Error ? error.message : 'Falha de rede' }; }
      if (result.status === 'SENT' || !isRetryable(result) || attempt === this.store.settings.maxRetries) break;
      await wait(this.store.settings.retryBackoff * 2 ** attempt);
    }
    const finalResult = result || { providerMessageId: '', status: 'FAILED' as const, errorMessage: 'Falha sem resposta do provider' };
    this.store.updateMessage(job.id, { status: finalResult.status, providerMessageId: finalResult.providerMessageId, errorMessage: finalResult.errorMessage }); if (finalResult.status === 'FAILED') { const campaignId = job.idempotencyKey.startsWith('campaign:') ? job.idempotencyKey.split(':')[1] : undefined; const deadLetter: DeadLetter = { jobId: job.id, leadId: job.conversationId, campaignId, error: finalResult.errorMessage, attempts: this.store.settings.maxRetries + 1, failedAt: new Date().toISOString() }; this.store.settings.deadLetters.push(deadLetter); if (this.redisConnection) void this.redisConnection.rpush('impulse:queue:dead-letters', JSON.stringify(deadLetter)).catch((error: unknown) => { this.store.settings.lastQueueError = error instanceof Error ? error.message : 'Redis indisponível'; }); }
    this.breaker.record(finalResult.status === 'SENT'); this.breaker.shouldPause();
  }
}
