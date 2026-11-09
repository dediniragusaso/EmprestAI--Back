// Spec 002-dados-iniciais: usuario obrigatorio, conta de teste e regras do script completo.
// O Auth e SIMULADO (R10): o simulado reproduz o efeito do trigger on_auth_user_changed inserindo
// a linha em public.users. O Auth real so e provado em producao (CA-06).
import { randomUUID } from 'node:crypto';
import { subirBanco, type BancoDeTeste } from './banco-teste';
import type { ClienteAuthAdmin } from './auth';
import { lerItens } from './dados';
import { EMAIL_PROFESSOR, TENANT_SLUG, executarDadosIniciais } from './principal';

jest.setTimeout(240_000);

class AuthSimulado implements ClienteAuthAdmin {
  readonly usuarios = new Map<string, { id: string; senha: string }>();
  chamadasBuscar = 0;
  chamadasCriar = 0;

  constructor(private readonly prisma: BancoDeTeste['prisma']) {}

  async buscarPorEmail(email: string) {
    this.chamadasBuscar += 1;
    const u = this.usuarios.get(email.toLowerCase());
    return u ? { id: u.id } : null;
  }

  async criar(dados: { email: string; senha: string }) {
    this.chamadasCriar += 1;
    const id = randomUUID();
    this.usuarios.set(dados.email.toLowerCase(), { id, senha: dados.senha });
    // Efeito do trigger do Auth: espelho em public.users, nome = e-mail (Q3).
    await this.prisma.user.create({ data: { id, email: dados.email, name: dados.email } });
    return { id };
  }
}

const ENV_BASE = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SEED_PROFESSOR_PASSWORD: 'senha-do-professor-de-teste',
};

describe('dados iniciais: usuarios e script completo', () => {
  let bd: BancoDeTeste;
  const itens = lerItens();

  beforeAll(async () => {
    bd = await subirBanco();
  });
  afterAll(async () => {
    await bd?.parar();
  });
  beforeEach(async () => {
    await bd.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE loans, equipment, memberships, users, tenants, audit_logs RESTART IDENTITY CASCADE',
    );
    await bd.prisma.tenant.create({ data: { slug: TENANT_SLUG, name: 'Suporte TI' } });
  });

  const rodar = (auth: AuthSimulado, env: Record<string, string | undefined>) =>
    executarDadosIniciais({ prisma: bd.prisma, auth, env, itens });

  it('CA-05: cria o professor no Auth uma vez, com espelho e membership COLABORADOR; repetir nao duplica', async () => {
    const auth = new AuthSimulado(bd.prisma);
    const r1 = await rodar(auth, ENV_BASE);
    const r2 = await rodar(auth, ENV_BASE);

    expect(r1.professor.criado).toBe(true);
    expect(r2.professor.criado).toBe(false);
    expect(auth.chamadasCriar).toBe(1);

    const tenant = await bd.prisma.tenant.findUniqueOrThrow({ where: { slug: TENANT_SLUG } });
    const usuario = await bd.prisma.user.findFirstOrThrow({ where: { email: EMAIL_PROFESSOR } });
    expect(usuario.name).toBe(EMAIL_PROFESSOR); // Q3: sem name nos metadados, o espelho usa o e-mail
    const memberships = await bd.prisma.membership.findMany({ where: { userId: usuario.id } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ tenantId: tenant.id, role: 'COLABORADOR' });
    expect(await bd.prisma.user.count()).toBe(1);
    expect(await bd.prisma.equipment.count()).toBe(12);
  });

  it('CA-05: usuario ja existente no Auth nao e recriado, nem tem a senha alterada, nem o papel reescrito', async () => {
    const auth = new AuthSimulado(bd.prisma);
    const antigo = await auth.criar({ email: EMAIL_PROFESSOR, senha: 'senha-antiga' });
    const tenant = await bd.prisma.tenant.findUniqueOrThrow({ where: { slug: TENANT_SLUG } });
    await bd.prisma.membership.create({ data: { userId: antigo.id, tenantId: tenant.id, role: 'OPERACOES' } });
    auth.chamadasCriar = 0;

    await rodar(auth, ENV_BASE);

    expect(auth.chamadasCriar).toBe(0);
    expect(auth.usuarios.get(EMAIL_PROFESSOR)?.senha).toBe('senha-antiga'); // Q12
    const m = await bd.prisma.membership.findFirstOrThrow({ where: { userId: antigo.id } });
    expect(m.role).toBe('OPERACOES'); // update vazio: nao reescreve o papel
  });

  it('CA-07: o tenant e o professor ficam com zero emprestimos', async () => {
    const auth = new AuthSimulado(bd.prisma);
    await rodar(auth, ENV_BASE);
    await rodar(auth, ENV_BASE);
    const usuario = await bd.prisma.user.findFirstOrThrow({ where: { email: EMAIL_PROFESSOR } });
    expect(await bd.prisma.loan.count()).toBe(0);
    expect(await bd.prisma.loan.count({ where: { userId: usuario.id } })).toBe(0);
    expect(await bd.prisma.equipment.count({ where: { status: 'EMPRESTADO' } })).toBe(0);
  });

  it('CA-11: com SEED_TESTE_EMAIL e SEED_TESTE_PASSWORD a conta de teste existe, COLABORADOR e sem emprestimos', async () => {
    const auth = new AuthSimulado(bd.prisma);
    const env = { ...ENV_BASE, SEED_TESTE_EMAIL: 'teste@example.org', SEED_TESTE_PASSWORD: 'senha-de-teste-123' };
    const r1 = await rodar(auth, env);
    const r2 = await rodar(auth, env);

    expect(r1.teste?.criado).toBe(true);
    expect(r2.teste?.criado).toBe(false);
    expect(await bd.prisma.user.count()).toBe(2);
    const conta = await bd.prisma.user.findFirstOrThrow({ where: { email: 'teste@example.org' } });
    const m = await bd.prisma.membership.findFirstOrThrow({ where: { userId: conta.id } });
    expect(m.role).toBe('COLABORADOR');
    expect(await bd.prisma.loan.count({ where: { userId: conta.id } })).toBe(0);
  });

  it('CA-11: sem as duas variaveis de teste nenhuma conta de teste e criada e o script termina sem erro', async () => {
    const auth = new AuthSimulado(bd.prisma);
    const semNenhuma = await rodar(auth, ENV_BASE);
    expect(semNenhuma.teste).toBeNull();
    expect(semNenhuma.avisos).toEqual([]);
    expect(await bd.prisma.user.count()).toBe(1);

    const soUma = await rodar(auth, { ...ENV_BASE, SEED_TESTE_EMAIL: 'teste@example.org' });
    expect(soUma.teste).toBeNull();
    expect(soUma.avisos).toHaveLength(1);
    expect(await bd.prisma.user.count()).toBe(1);
  });

  it('CA-05: sem SEED_PROFESSOR_PASSWORD falha antes de tocar no Auth e antes de gravar qualquer coisa', async () => {
    const auth = new AuthSimulado(bd.prisma);
    await expect(rodar(auth, { SUPABASE_URL: ENV_BASE.SUPABASE_URL })).rejects.toThrow(/SEED_PROFESSOR_PASSWORD/);
    expect(auth.chamadasBuscar + auth.chamadasCriar).toBe(0);
    expect(await bd.prisma.equipment.count()).toBe(0);
  });

  it('CA-01: sem o tenant suporte_ti o script falha mandando rodar db:seed e nao cria o tenant', async () => {
    await bd.prisma.$executeRawUnsafe('TRUNCATE TABLE tenants CASCADE');
    const auth = new AuthSimulado(bd.prisma);
    await expect(rodar(auth, ENV_BASE)).rejects.toThrow(/db:seed/);
    expect(await bd.prisma.tenant.count()).toBe(0);
    expect(auth.chamadasCriar).toBe(0);
  });
});
