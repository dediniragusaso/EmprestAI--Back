import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { loadEnv } from './config/env';

export async function createApp(): Promise<INestApplication> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('v1', { exclude: [{ path: '/', method: RequestMethod.GET }] });
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalFilters(new ProblemDetailsFilter());
  return app;
}
