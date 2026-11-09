// Spec 002-dados-iniciais: CA-08 (nenhum segredo no git) e CA-14 (seed.ts e db:seed intactos).
// Os valores de segredo, quando existem no ambiente do teste, so passam por stdin do `git grep -l`:
// nunca por argumento, saida ou mensagem de erro. O teste olha os arquivos versionados (working
// tree dos repositorios), nao o historico.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

jest.setTimeout(120_000);

const BACK = path.resolve(__dirname, '..');
const REPOS: Array<{ nome: string; dir: string }> = [
  { nome: 'raiz', dir: path.resolve(BACK, '..') },
  { nome: 'back', dir: BACK },
  { nome: 'front', dir: path.resolve(BACK, '..', 'front') },
].filter((r) => existsSync(path.join(r.dir, '.git')));

const NOMES_SEGREDO = [
  'SEED_PROFESSOR_PASSWORD',
  'SEED_TESTE_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PIXABAY_API_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
];

function git(dir: string, args: string[], input?: string) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
}
const arquivosVersionados = (dir: string) => git(dir, ['ls-files']).stdout.split('\n').filter(Boolean);

describe('repositorios sem segredo', () => {
  it('CA-08: existem os tres repositorios e o git responde', () => {
    expect(REPOS.map((r) => r.nome)).toEqual(expect.arrayContaining(['raiz', 'back']));
    for (const r of REPOS) expect(git(r.dir, ['rev-parse', 'HEAD']).status).toBe(0);
  });

  it('CA-08: nenhum .env versionado alem do .env.example, em nenhum repositorio', () => {
    for (const r of REPOS) {
      const indevidos = arquivosVersionados(r.dir).filter(
        (f) => /(^|\/)\.env(\..+)?$/.test(f) && !/(^|\/)\.env\.example$/.test(f),
      );
      expect({ repo: r.nome, indevidos }).toEqual({ repo: r.nome, indevidos: [] });
    }
  });

  it('CA-08: os .env.example trazem os nomes dos segredos sem valor', () => {
    const exemplo = readFileSync(path.join(BACK, '.env.example'), 'utf8');
    for (const nome of ['SEED_PROFESSOR_PASSWORD', 'SEED_TESTE_EMAIL', 'SEED_TESTE_PASSWORD', 'SUPABASE_SERVICE_ROLE_KEY']) {
      expect(exemplo).toMatch(new RegExp(`^${nome}=\\s*$`, 'm'));
    }
    for (const r of REPOS) {
      for (const f of arquivosVersionados(r.dir).filter((x) => /(^|\/)\.env\.example$/.test(x))) {
        const texto = readFileSync(path.join(r.dir, f), 'utf8');
        const comValor = texto
          .split('\n')
          .filter((l) => /^(SEED_PROFESSOR_PASSWORD|SEED_TESTE_PASSWORD|SUPABASE_SERVICE_ROLE_KEY|PIXABAY_API_KEY)\s*=\s*\S/.test(l));
        expect({ repo: r.nome, arquivo: f, linhas: comValor.length }).toEqual({ repo: r.nome, arquivo: f, linhas: 0 });
      }
    }
  });

  it('CA-08: nenhum arquivo versionado tem JWT nem atribuicao de segredo com valor', () => {
    const jwt = String.raw`eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`;
    const atribuicao = String.raw`^(SEED_PROFESSOR_PASSWORD|SEED_TESTE_PASSWORD|SUPABASE_SERVICE_ROLE_KEY|PIXABAY_API_KEY)[[:space:]]*=[[:space:]]*[^[:space:]]`;
    for (const r of REPOS) {
      for (const padrao of [jwt, atribuicao]) {
        const achados = git(r.dir, ['grep', '-l', '-I', '-E', '-e', padrao]);
        // status 1 = nenhuma ocorrencia; 0 = achou (lista so os nomes dos arquivos).
        expect({ repo: r.nome, status: achados.status, arquivos: achados.stdout.trim() }).toEqual({
          repo: r.nome,
          status: 1,
          arquivos: '',
        });
      }
    }
  });

  it('CA-08: os valores reais de segredo carregados no ambiente de teste nao aparecem em arquivo versionado', () => {
    let verificados = 0;
    for (const nome of NOMES_SEGREDO) {
      const valor = process.env[nome];
      if (!valor || valor.length < 8) continue; // sem valor no ambiente (ex.: CI): nada a procurar
      verificados += 1;
      for (const r of REPOS) {
        // O valor entra por stdin; a resposta so diz SE achou e em quais arquivos, nunca o valor.
        const achados = git(r.dir, ['grep', '-l', '-I', '-F', '-f', '-'], `${valor}\n`);
        expect({ segredo: nome, repo: r.nome, achou: achados.status === 0 }).toEqual({
          segredo: nome,
          repo: r.nome,
          achou: false,
        });
      }
    }
    // So a contagem: quantos segredos estavam no ambiente e foram procurados (0 = nenhum, ex.: CI).
    // Para uma busca com os valores reais, rode o teste com o .env no ambiente do operador.
    console.info(`CA-08: segredos do ambiente procurados nos arquivos versionados: ${verificados}`);
    expect(verificados).toBeGreaterThanOrEqual(0);
  });
});

describe('seed existente intacto', () => {
  it('CA-14: prisma/seed.ts e igual ao do commit 9e151db e db:seed nao mudou', () => {
    const original = git(BACK, ['show', '9e151db:prisma/seed.ts']);
    expect(original.status).toBe(0);
    const atual = readFileSync(path.join(BACK, 'prisma', 'seed.ts'), 'utf8');
    expect(atual.replace(/\r\n/g, '\n')).toBe(original.stdout.replace(/\r\n/g, '\n'));

    const pacote = JSON.parse(readFileSync(path.join(BACK, 'package.json'), 'utf8'));
    expect(pacote.scripts['db:seed']).toBe('prisma db seed');
    expect(pacote.prisma.seed).toBe('ts-node prisma/seed.ts');
    // Continua so criando o tenant: nenhuma referencia a equipamento ou usuario.
    expect(atual).not.toMatch(/equipment|membership|auth/i);
  });
});
