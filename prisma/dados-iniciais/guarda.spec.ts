// Spec 002-dados-iniciais, CA-09: o script nunca escreve no remoto sem a confirmacao do operador.
// Sem Docker: so a funcao da guarda e a execucao real do ponto de entrada com destino remoto falso.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ErroGuarda, VARIAVEL_CONFIRMACAO, conferirDestino } from './guarda';

jest.setTimeout(180_000);

const LOCAL = {
  DATABASE_URL: 'postgresql://u:p@127.0.0.1:54322/postgres',
  DIRECT_URL: 'postgresql://u:p@localhost:54322/postgres',
  SUPABASE_URL: 'http://127.0.0.1:54321',
};
const REMOTO = {
  DATABASE_URL: 'postgresql://u:senha-falsa-do-banco@db.exemplo.supabase.co:5432/postgres',
  DIRECT_URL: 'postgresql://u:senha-falsa-do-banco@db.exemplo.supabase.co:5432/postgres',
  SUPABASE_URL: 'https://exemplo.supabase.co',
};

describe('guarda de producao', () => {
  it('CA-09: destino local passa sem confirmacao', () => {
    expect(conferirDestino(LOCAL)).toMatchObject({ local: true });
  });

  it('CA-09: destino remoto sem confirmacao e recusado, citando so os hosts', () => {
    expect(() => conferirDestino(REMOTO)).toThrow(ErroGuarda);
    try {
      conferirDestino(REMOTO);
    } catch (erro) {
      const msg = (erro as Error).message;
      expect(msg).toContain('db.exemplo.supabase.co');
      expect(msg).toContain(VARIAVEL_CONFIRMACAO);
      expect(msg).not.toContain('senha-falsa-do-banco');
    }
  });

  it('CA-09: basta UM host remoto (por exemplo so o SUPABASE_URL) para exigir a confirmacao', () => {
    expect(() => conferirDestino({ ...LOCAL, SUPABASE_URL: 'https://exemplo.supabase.co' })).toThrow(ErroGuarda);
  });

  it('CA-09: so a confirmacao exata "sim" libera o destino remoto', () => {
    expect(conferirDestino({ ...REMOTO, [VARIAVEL_CONFIRMACAO]: 'sim' })).toMatchObject({ local: false });
    expect(() => conferirDestino({ ...REMOTO, [VARIAVEL_CONFIRMACAO]: 'true' })).toThrow(ErroGuarda);
    expect(() => conferirDestino({ ...REMOTO, [VARIAVEL_CONFIRMACAO]: '' })).toThrow(ErroGuarda);
  });

  it('CA-09: falha fechada: DATABASE_URL ou SUPABASE_URL ausente e erro, nao "local"', () => {
    expect(() => conferirDestino({ SUPABASE_URL: LOCAL.SUPABASE_URL })).toThrow(/DATABASE_URL ausente/);
    expect(() => conferirDestino({ DATABASE_URL: LOCAL.DATABASE_URL })).toThrow(/SUPABASE_URL ausente/);
  });

  it('CA-09: o script de verdade, apontado para host remoto sem confirmacao, sai com erro e nao escreve', () => {
    const raiz = path.resolve(__dirname, '..', '..');
    const env = {
      ...process.env,
      ...REMOTO,
      SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa-service-role',
      SEED_PROFESSOR_PASSWORD: 'senha-falsa-do-professor',
    } as NodeJS.ProcessEnv;
    delete env[VARIAVEL_CONFIRMACAO];

    const r = spawnSync(process.execPath, ['-r', 'ts-node/register', 'prisma/dados-iniciais.ts'], {
      cwd: raiz,
      env,
      encoding: 'utf8',
      timeout: 150_000,
    });

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Destino REMOTO');
    expect(r.stderr).toContain('Nada foi escrito');
    // Nenhum valor de segredo na saida.
    const saida = `${r.stdout}${r.stderr}`;
    for (const segredo of ['senha-falsa-do-banco', 'chave-falsa-service-role', 'senha-falsa-do-professor']) {
      expect(saida).not.toContain(segredo);
    }
    // Parou antes de qualquer etapa de escrita.
    expect(r.stdout).not.toContain('equipamentos:');
    expect(r.stdout).not.toContain('professor:');
  });
});
