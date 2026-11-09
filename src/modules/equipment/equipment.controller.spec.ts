import { subirAppDeTeste, type AppDeTeste } from '../../testing/app';
import { EquipmentModule } from './equipment.module';

jest.setTimeout(240_000);

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Fatia 003, T7. GET /v1/equipment: CA-01, CA-03, CA-13, CA-14 e CA-16 (parte do catalogo).
describe('GET /v1/equipment', () => {
  let t: AppDeTeste;

  beforeAll(async () => {
    t = await subirAppDeTeste({ modulos: [EquipmentModule] });
  });

  afterAll(async () => {
    await t?.parar();
  });

  it('CA-01: devolve os 12 equipamentos com os campos do contrato, em ordem de patrimonio, e o bloco viewer', async () => {
    const u = await t.criarUsuario('A');
    const res = await t.http().get('/v1/equipment').set(auth(u.token));
    expect(res.status).toBe(200);
    const itens = (res.body.items as { patrimonio: string }[]).filter((i) => i.patrimonio?.startsWith('TI-'));
    expect(itens.map((i) => i.patrimonio)).toEqual(
      Array.from({ length: 12 }, (_, n) => `TI-${String(n + 1).padStart(4, '0')}`),
    );
    expect(Object.keys(res.body.items[0]).sort()).toEqual(
      ['category', 'id', 'imageUrl', 'loan', 'name', 'patrimonio', 'status'].sort(),
    );
    expect(res.body.items[0].imageUrl).toMatch(/\/storage\/v1\/object\/public\/imagens\/equipamentos\/TI-0001\.jpg$/);
    expect(res.body.viewer).toEqual({
      openLoans: 0,
      maxLoans: 3,
      overdue: false,
      today: '2026-11-09',
      proposedDueAt: '2026-11-23',
    });
  });

  it('CA-01: o cursor percorre o catalogo sem repetir nem pular item', async () => {
    const u = await t.criarUsuario('A');
    await t.criarEquipamento('A', { patrimonio: undefined }); // sem patrimonio explicito: recebe X-...
    await t.prisma.equipment.create({ data: { tenantId: t.tenantA, name: 'Sem patrimonio', category: 'CABO' } });
    const todos = await t.prisma.equipment.count({ where: { tenantId: t.tenantA } });
    const ids: string[] = [];
    let cursor: string | null = null;
    let paginas = 0;
    do {
      const res: { body: { items: { id: string }[]; nextCursor: string | null } } = await t
        .http()
        .get('/v1/equipment')
        .query({ limit: 5, ...(cursor ? { cursor } : {}) })
        .set(auth(u.token));
      ids.push(...res.body.items.map((i) => i.id));
      cursor = res.body.nextCursor;
      paginas += 1;
    } while (cursor && paginas < 20);
    expect(ids).toHaveLength(todos);
    expect(new Set(ids).size).toBe(todos);
    const ultimo = await t.prisma.equipment.findUniqueOrThrow({ where: { id: ids[ids.length - 1] } });
    expect(ultimo.patrimonio).toBeNull(); // sem patrimonio vem por ultimo
  });

  it('CA-01: limit e cursor invalidos devolvem 400 em Problem Details', async () => {
    const u = await t.criarUsuario('A');
    for (const query of [{ limit: 0 }, { limit: 101 }, { limit: 'abc' }, { cursor: 'nao-e-cursor' }]) {
      const res = await t.http().get('/v1/equipment').query(query).set(auth(u.token));
      expect(res.status).toBe(400);
      expect(res.type).toBe('application/problem+json');
    }
  });

  it('CA-03: MANUTENCAO e EMPRESTADO aparecem com o status real; o EMPRESTADO traz dueAt e isMine, sem nome nem e-mail', async () => {
    const eu = await t.criarUsuario('A');
    const outra = await t.criarUsuario('A');
    const meu = await t.criarEquipamento('A', { patrimonio: 'Z-0001' });
    const dela = await t.criarEquipamento('A', { patrimonio: 'Z-0002' });
    await t.semearEmprestimo({ userId: eu.id, equipmentId: meu.id, dueAt: '2026-11-20' });
    await t.semearEmprestimo({ userId: outra.id, equipmentId: dela.id, dueAt: '2026-11-25' });

    const res = await t.http().get('/v1/equipment').query({ limit: 100 }).set(auth(eu.token));
    const por = (p: string) => (res.body.items as { patrimonio: string; status: string; loan: unknown }[]).find((i) => i.patrimonio === p)!;
    expect(por('Z-0001')).toMatchObject({ status: 'EMPRESTADO', loan: { dueAt: '2026-11-20', isMine: true } });
    expect(por('Z-0002')).toMatchObject({ status: 'EMPRESTADO', loan: { dueAt: '2026-11-25', isMine: false } });
    expect(por('TI-0004')).toMatchObject({ status: 'MANUTENCAO', loan: null });
    expect(por('TI-0001')).toMatchObject({ status: 'DISPONIVEL', loan: null });
    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain(outra.email);
    expect(texto).not.toContain(outra.id);
  });

  it('CA-01: o viewer conta os emprestimos abertos e marca atraso so com dueAt anterior a hoje', async () => {
    const u = await t.criarUsuario('A');
    const a = await t.criarEquipamento('A');
    const b = await t.criarEquipamento('A');
    await t.semearEmprestimo({ userId: u.id, equipmentId: a.id, dueAt: '2026-11-09' }); // = hoje: nao e atraso
    let res = await t.http().get('/v1/equipment').set(auth(u.token));
    expect(res.body.viewer).toMatchObject({ openLoans: 1, overdue: false });
    await t.semearEmprestimo({ userId: u.id, equipmentId: b.id, dueAt: '2026-11-08' }); // ontem: atraso
    res = await t.http().get('/v1/equipment').set(auth(u.token));
    expect(res.body.viewer).toMatchObject({ openLoans: 2, overdue: true });
  });

  it('CA-13: o catalogo do tenant A nao traz nenhum item do tenant B', async () => {
    const u = await t.criarUsuario('A');
    await t.criarEquipamento('B', { name: 'Segredo do B', patrimonio: 'TB-9999' });
    const res = await t.http().get('/v1/equipment').query({ limit: 100 }).set(auth(u.token));
    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain('TB-000');
    expect(texto).not.toContain('TB-9999');
    expect(texto).not.toContain('Segredo do B');
    expect(texto).not.toContain('Item do outro tenant');
  });

  it('CA-13: tenantId enviado na query ou no header e ignorado', async () => {
    const u = await t.criarUsuario('A');
    const res = await t
      .http()
      .get('/v1/equipment')
      .query({ tenantId: t.tenantB, limit: 100 })
      .set({ ...auth(u.token), 'x-tenant-id': t.tenantB });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('Item do outro tenant');
  });

  it('CA-14: sem token e 401; sem vinculo ou so com outro tenant e 403', async () => {
    expect((await t.http().get('/v1/equipment')).status).toBe(401);
    const semVinculo = await t.criarUsuario(null);
    const soB = await t.criarUsuario('B');
    for (const u of [semVinculo, soB]) {
      const res = await t.http().get('/v1/equipment').set(auth(u.token));
      expect(res.status).toBe(403);
      expect(res.type).toBe('application/problem+json');
    }
  });

  it('CA-16: "hoje" do catalogo e do servidor em America/Sao_Paulo, inclusive na virada da meia-noite', async () => {
    const u = await t.criarUsuario('A');
    t.clock.definir('2026-11-10T02:30:00.000Z'); // 23:30 de 09/11 em Brasilia
    let res = await t.http().get('/v1/equipment').set(auth(u.token));
    expect(res.body.viewer).toMatchObject({ today: '2026-11-09', proposedDueAt: '2026-11-23' });
    t.clock.definir('2026-11-10T03:30:00.000Z'); // 00:30 de 10/11 em Brasilia
    res = await t.http().get('/v1/equipment').set(auth(u.token));
    expect(res.body.viewer).toMatchObject({ today: '2026-11-10', proposedDueAt: '2026-11-24' });
    t.clock.definir('2026-11-09T15:00:00.000Z');
  });
});
