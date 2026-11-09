import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { loadEnv } from './config/env';

/** Prefixo `/v1` e filtro de erro: o que o app real e o app de teste têm em comum. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('v1', { exclude: [{ path: '/', method: RequestMethod.GET }] });
  app.useGlobalFilters(new ProblemDetailsFilter());
}

export async function createApp(): Promise<INestApplication> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  configureApp(app);
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });
  return app;
}
