import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './config.js';
import { MemoryStore, ProspectSearch } from './store.js';
import { runSearch } from './prospectingRoutes.js';
export class ProspectingQueue {
  private queue?: Queue<{ searchId:string }>;
  private worker?: Worker<{ searchId:string }>;
  private connection?: Redis;
  constructor(private store: MemoryStore) {
    if (!env.REDIS_URL || process.env.VERCEL) return;
    this.connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    this.queue = new Queue('impulse-prospecting-search', { connection: this.connection });
    this.worker = new Worker('impulse-prospecting-search', async (job) => { const search=this.store.prospectingSearches.find(item=>item.id===job.data.searchId); if(search) await runSearch(search,this.store); }, { connection: this.connection, concurrency: 2 });
  }
  async enqueue(search: ProspectSearch) { if (this.queue && search.quantity >= 100) { await this.queue.add('discover', { searchId:search.id }, { jobId:search.id, attempts:3, backoff:{ type:'exponential', delay:1000 }, removeOnComplete:100, removeOnFail:100 }); return; } if (process.env.VERCEL) { await runSearch(search,this.store); return; } void runSearch(search,this.store); }
  async close() { await this.worker?.close(); await this.queue?.close(); await this.connection?.quit(); }
}
