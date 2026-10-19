import serverlessExpress from '@vendia/serverless-express';
import { createApp } from '../src/bootstrap';

type Handler = (req: unknown, res: unknown) => unknown;

// Instância cacheada fora do handler (ADR-001 §3): evita bootstrap a cada request.
let cached: Handler | undefined;

async function bootstrap(): Promise<Handler> {
  const app = await createApp();
  await app.init();
  const handler = serverlessExpress({ app: app.getHttpAdapter().getInstance() });
  return handler as unknown as Handler;
}

export default async function handler(req: unknown, res: unknown) {
  cached ??= await bootstrap();
  return cached(req, res);
}
