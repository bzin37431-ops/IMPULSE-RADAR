import type { IncomingMessage, ServerResponse } from 'node:http';
import { env, assertOfficialProvider } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { PrismaPersistence } from '../src/persistence.js';
import { MemoryStore } from '../src/store.js';

type VercelRequest = IncomingMessage & { url?: string };
type VercelResponse = ServerResponse;

async function createApp() {
  assertOfficialProvider();

  const persistence = env.DATABASE_URL ? new PrismaPersistence() : undefined;
  const store = new MemoryStore(env.TEST_MODE, persistence);

  if (persistence) {
    await persistence.load(store);
  }

  const app = buildApp({
    store,
    persistence,
    serveStatic: false,
  });

  await app.ready();
  return app;
}

const appPromise = createApp();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await appPromise;

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        res.off('finish', onFinish);
        res.off('close', onFinish);
        res.off('error', onError);
      };
      const onFinish = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      res.once('finish', onFinish);
      res.once('close', onFinish);
      res.once('error', onError);
      app.server.emit('request', req, res);
    });
  } catch (error) {
    if (res.headersSent) return;

    const message = error instanceof Error ? error.message : 'Backend indisponível.';
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      error: 'BACKEND_NOT_READY',
      message,
    }));
  }
}
