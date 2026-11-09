// Apoio dos testes (spec 002-dados-iniciais, R10 e Q17): Postgres descartavel com Testcontainers.
// As migrations sao aplicadas copiando cada migration.sql para o conteiner e rodando `psql -f`,
// em ordem: sem dependencia nova e sem o comando que o permissions.deny nega ao agente.
// Nunca fala com o Supabase remoto: o banco nasce e morre dentro do teste.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const IMAGEM = 'postgres:17-alpine'; // mesma versao maior de supabase/config.toml
const PASTA_MIGRATIONS = path.resolve(__dirname, '..', 'migrations');

export interface BancoDeTeste {
  prisma: PrismaClient;
  uri: string;
  parar(): Promise<void>;
}

async function aplicarMigrations(container: StartedPostgreSqlContainer): Promise<string[]> {
  const pastas = readdirSync(PASTA_MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const pasta of pastas) {
    const destino = `/tmp/${pasta}.sql`;
    await container.copyContentToContainer([
      { content: readFileSync(path.join(PASTA_MIGRATIONS, pasta, 'migration.sql'), 'utf8'), target: destino },
    ]);
    const r = await container.exec([
      'psql', '-U', container.getUsername(), '-d', container.getDatabase(),
      '-v', 'ON_ERROR_STOP=1', '-f', destino,
    ]);
    if (r.exitCode !== 0) {
      throw new Error(`migration ${pasta} falhou (exit ${r.exitCode}): ${r.output.slice(-400)}`);
    }
  }
  return pastas;
}

export async function subirBanco(): Promise<BancoDeTeste & { migrations: string[] }> {
  const container = await new PostgreSqlContainer(IMAGEM).start();
  const migrations = await aplicarMigrations(container);
  const uri = container.getConnectionUri();
  const prisma = new PrismaClient({ datasourceUrl: uri });
  return {
    prisma,
    uri,
    migrations,
    async parar() {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
