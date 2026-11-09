import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Token para o teste apontar o cliente para o Postgres descartável (nunca para o remoto). */
export const PRISMA_DATASOURCE_URL = Symbol('PRISMA_DATASOURCE_URL');

// ADR-001 §3 e §5: o Repository isola o Prisma; o cliente vive aqui, uma instância por processo.
// Em runtime a URL vem de DATABASE_URL (pooler, connection_limit=1), lida pelo próprio Prisma.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Optional() @Inject(PRISMA_DATASOURCE_URL) datasourceUrl?: string) {
    super(datasourceUrl ? { datasourceUrl } : undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
