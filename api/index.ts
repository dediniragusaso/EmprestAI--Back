import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/bootstrap';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

// Instância cacheada fora do handler (ADR-001 §3): evita bootstrap a cada request.
// A Vercel entrega req/res do Node, então o app Express é o próprio handler
// (o @vendia/serverless-express espera eventos da AWS Lambda, não serve aqui).
let cached: Handler | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!cached) {
      const app = await createApp();
      await app.init();
      cached = app.getHttpAdapter().getInstance() as Handler;
    }
    return cached(req, res);
  } catch (err) {
    console.error(err);
    // A mensagem de erro de configuração só cita nomes de variáveis, nunca valores.
    const detail = err instanceof Error ? err.message : 'Erro interno.';
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/problem+json');
    res.end(JSON.stringify({ type: 'about:blank', title: 'INTERNAL_SERVER_ERROR', status: 500, detail }));
  }
}
