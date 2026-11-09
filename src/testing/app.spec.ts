import { MeController } from '../modules/auth/me.controller';
import { HealthController } from '../modules/health/health.controller';
import { subirAppDeTeste, type AppDeTeste } from './app';

jest.setTimeout(240_000);

// Fatia 003, T6: o helper sobe a app sobre o Postgres descartavel (base de CA-01 a CA-18).
describe('helper de app de teste', () => {
  let t: AppDeTeste;

  beforeAll(async () => {
    t = await subirAppDeTeste({ controllers: [HealthController, MeController] });
  });

  afterAll(async () => {
    await t?.parar();
  });

  it('CA-01 (base): o tenant A nasce com os 12 equipamentos da spec 002, 9 DISPONIVEL e 3 MANUTENCAO', async () => {
    const itens = await t.prisma.equipment.findMany({ where: { tenantId: t.tenantA } });
    expect(itens).toHaveLength(12);
    expect(itens.filter((i) => i.status === 'DISPONIVEL')).toHaveLength(9);
    expect(itens.filter((i) => i.status === 'MANUTENCAO')).toHaveLength(3);
    expect(await t.prisma.equipment.count({ where: { tenantId: t.tenantB } })).toBe(2);
  });

  it('CA-14 (base): rota com prefixo /v1 e token falso aceito; sem token e 401 em Problem Details', async () => {
    const u = await t.criarUsuario('A');
    expect((await t.http().get('/v1/health')).status).toBe(200);
    const ok = await t.http().get('/v1/me').set('Authorization', `Bearer ${u.token}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ id: u.id, email: u.email });
    const sem = await t.http().get('/v1/me');
    expect(sem.status).toBe(401);
    expect(sem.type).toBe('application/problem+json');
  });

  it('CA-08 (base): semearEmprestimo cria o emprestimo aberto e marca o equipamento EMPRESTADO', async () => {
    const u = await t.criarUsuario('A');
    const e = await t.criarEquipamento('A');
    const loan = await t.semearEmprestimo({ userId: u.id, equipmentId: e.id, dueAt: '2026-11-01' });
    expect(loan.returnedAt).toBeNull();
    expect((await t.prisma.equipment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('EMPRESTADO');
  });
});
