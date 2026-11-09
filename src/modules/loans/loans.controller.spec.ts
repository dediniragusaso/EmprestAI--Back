import { randomUUID } from 'node:crypto';
import { subirAppDeTeste, type AppDeTeste, type Usuario } from '../../testing/app';
import { AuditRepository } from './audit.repository';
import { LoansModule } from './loans.module';

jest.setTimeout(240_000);

// Fatia 003, T8. POST /v1/loans: CA-05 a CA-09, CA-13, CA-14, CA-16, CA-17 e CA-18.
describe('POST /v1/loans', () => {
  let t: AppDeTeste;

  beforeAll(async () => {
    t = await subirAppDeTeste({ modulos: [LoansModule] });
  });

  afterAll(async () => {
    await t?.parar();
  });

  const pedir = (u: Usuario, equipmentId: unknown, extra: object = {}) =>
    t.http().post('/v1/loans').set('Authorization', `Bearer ${u.token}`).send({ equipmentId, ...extra });

  const abertos = (userId: string) =>
    t.prisma.loan.count({ where: { userId, returnedAt: null } });
  const statusDe = async (id: string) =>
    (await t.prisma.equipment.findUniqueOrThrow({ where: { id } })).status;
  const auditorias = () => t.prisma.auditLog.count({ where: { action: 'loan.open' } });

  it('CA-05: item DISPONIVEL vira emprestimo 201, com dueAt = hoje + 14 e status EMPRESTADO no banco', async () => {
    const u = await t.criarUsuario('A');
    const e = await t.criarEquipamento('A', { name: 'Notebook de teste', patrimonio: 'T8-0001' });
    const res = await pedir(u, e.id);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      equipmentId: e.id,
      equipmentName: 'Notebook de teste',
      patrimonio: 'T8-0001',
      dueAt: '2026-11-23',
    });
    const loan = await t.prisma.loan.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(loan).toMatchObject({ userId: u.id, tenantId: t.tenantA, equipmentId: e.id, returnedAt: null });
    expect(loan.dueAt.toISOString().slice(0, 10)).toBe('2026-11-23');
    expect(await statusDe(e.id)).toBe('EMPRESTADO');
  });

  it('CA-06: se a gravacao falha depois de criar o loan, nao resta loan nem o status mudado', async () => {
    const u = await t.criarUsuario('A');
    const e = await t.criarEquipamento('A');
    const espiao = jest
      .spyOn(AuditRepository.prototype, 'registrar')
      .mockRejectedValueOnce(new Error('falha injetada na auditoria'));
    const res = await pedir(u, e.id);
    espiao.mockRestore();
    expect(res.status).toBe(500);
    expect(await abertos(u.id)).toBe(0);
    expect(await statusDe(e.id)).toBe('DISPONIVEL');
  });

  it('CA-07: com 3 emprestimos abertos, o 4o pedido e 409 loan-limit-reached e nada e gravado', async () => {
    const u = await t.criarUsuario('A');
    for (let i = 0; i < 3; i += 1) {
      const e = await t.criarEquipamento('A');
      await t.semearEmprestimo({ userId: u.id, equipmentId: e.id, dueAt: '2026-11-20' });
    }
    const alvo = await t.criarEquipamento('A');
    const antes = await auditorias();
    const res = await pedir(u, alvo.id);
    expect(res.status).toBe(409);
    expect(res.type).toBe('application/problem+json');
    expect(res.body).toMatchObject({
      code: 'loan-limit-reached',
      detail: 'Limite de 3 itens: devolva um item antes de pedir outro.',
    });
    expect(await abertos(u.id)).toBe(3);
    expect(await statusDe(alvo.id)).toBe('DISPONIVEL');
    expect(await auditorias()).toBe(antes);
  });

  it('CA-08: com emprestimo em atraso o pedido e 409 loan-overdue e nada e gravado', async () => {
    const u = await t.criarUsuario('A');
    const vencido = await t.criarEquipamento('A');
    await t.semearEmprestimo({ userId: u.id, equipmentId: vencido.id, dueAt: '2026-11-08' });
    const alvo = await t.criarEquipamento('A');
    const res = await pedir(u, alvo.id);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'loan-overdue',
      detail: 'Bloqueado por atraso: devolva o item vencido antes de pedir outro.',
    });
    expect(await abertos(u.id)).toBe(1);
    expect(await statusDe(alvo.id)).toBe('DISPONIVEL');
  });

  it('CA-08: dueAt igual a hoje nao e atraso, o pedido e aceito', async () => {
    const u = await t.criarUsuario('A');
    const vencendoHoje = await t.criarEquipamento('A');
    await t.semearEmprestimo({ userId: u.id, equipmentId: vencendoHoje.id, dueAt: '2026-11-09' });
    const alvo = await t.criarEquipamento('A');
    expect((await pedir(u, alvo.id)).status).toBe(201);
  });

  it('CA-09: item em MANUTENCAO e 409 equipment-unavailable; nada e gravado', async () => {
    const u = await t.criarUsuario('A');
    const e = await t.criarEquipamento('A', { status: 'MANUTENCAO' });
    const res = await pedir(u, e.id);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'equipment-unavailable',
      detail: 'Indisponível: este equipamento está em manutenção.',
    });
    expect(await abertos(u.id)).toBe(0);
    expect(await statusDe(e.id)).toBe('MANUTENCAO');
  });

  it('CA-09: item EMPRESTADO a outra pessoa e 409 equipment-already-loaned; ao proprio, "Está com você."', async () => {
    const eu = await t.criarUsuario('A');
    const outra = await t.criarUsuario('A');
    const dela = await t.criarEquipamento('A');
    const meu = await t.criarEquipamento('A');
    await t.semearEmprestimo({ userId: outra.id, equipmentId: dela.id, dueAt: '2026-11-20' });
    await t.semearEmprestimo({ userId: eu.id, equipmentId: meu.id, dueAt: '2026-11-20' });

    const r1 = await pedir(eu, dela.id);
    expect(r1.status).toBe(409);
    expect(r1.body).toMatchObject({
      code: 'equipment-already-loaned',
      detail: 'Emprestado: outra pessoa acabou de ficar com este equipamento.',
    });
    const r2 = await pedir(eu, meu.id);
    expect(r2.status).toBe(409);
    expect(r2.body).toMatchObject({ code: 'equipment-already-loaned', detail: 'Está com você.' });
    expect(await abertos(eu.id)).toBe(1);
    expect(await t.prisma.loan.count({ where: { equipmentId: dela.id, returnedAt: null } })).toBe(1);
  });

  it('CA-09 (Q12): o equipamento e verificado antes da pessoa (em atraso e no limite, item em manutencao ainda e "indisponivel")', async () => {
    const u = await t.criarUsuario('A');
    const vencido = await t.criarEquipamento('A');
    await t.semearEmprestimo({ userId: u.id, equipmentId: vencido.id, dueAt: '2026-11-01' });
    const manutencao = await t.criarEquipamento('A', { status: 'MANUTENCAO' });
    expect((await pedir(u, manutencao.id)).body.code).toBe('equipment-unavailable');
  });

  it('CA-13: equipamento de outro tenant ou inexistente e 404 e nada e gravado', async () => {
    const u = await t.criarUsuario('A');
    const doB = await t.criarEquipamento('B');
    const antes = await auditorias();
    for (const id of [doB.id, randomUUID()]) {
      const res = await pedir(u, id);
      expect(res.status).toBe(404);
      expect(res.type).toBe('application/problem+json');
    }
    expect(await statusDe(doB.id)).toBe('DISPONIVEL');
    expect(await t.prisma.loan.count({ where: { equipmentId: doB.id } })).toBe(0);
    expect(await auditorias()).toBe(antes);
  });

  it('CA-13: tenantId e userId no corpo sao ignorados (o tenant e a pessoa vem do servidor)', async () => {
    const u = await t.criarUsuario('A');
    const outra = await t.criarUsuario('A');
    const e = await t.criarEquipamento('A');
    const res = await pedir(u, e.id, { tenantId: t.tenantB, userId: outra.id });
    expect(res.status).toBe(201);
    const loan = await t.prisma.loan.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(loan.tenantId).toBe(t.tenantA);
    expect(loan.userId).toBe(u.id);
  });

  it('CA-14: sem token e 401; sem vinculo ou so com outro tenant e 403, sem gravar nada', async () => {
    const e = await t.criarEquipamento('A');
    expect((await t.http().post('/v1/loans').send({ equipmentId: e.id })).status).toBe(401);
    for (const u of [await t.criarUsuario(null), await t.criarUsuario('B')]) {
      const res = await pedir(u, e.id);
      expect(res.status).toBe(403);
      expect(res.type).toBe('application/problem+json');
    }
    expect(await statusDe(e.id)).toBe('DISPONIVEL');
  });

  it('CA-16: com o relogio congelado em D, o dueAt criado e D + 14, inclusive na virada de Brasilia', async () => {
    const u = await t.criarUsuario('A');
    t.clock.definir('2026-11-10T02:59:00.000Z'); // 23:59 de 09/11 em Brasilia
    const a = await t.criarEquipamento('A');
    expect((await pedir(u, a.id)).body.dueAt).toBe('2026-11-23');
    t.clock.definir('2026-11-10T03:01:00.000Z'); // 00:01 de 10/11 em Brasilia
    const b = await t.criarEquipamento('A');
    expect((await pedir(u, b.id)).body.dueAt).toBe('2026-11-24');
    t.clock.definir('2026-11-09T15:00:00.000Z');
  });

  it('CA-17: corpo invalido devolve 400 em Problem Details e nao grava nada', async () => {
    const u = await t.criarUsuario('A');
    const antes = await auditorias();
    for (const corpo of [{}, { equipmentId: 'nao-e-uuid' }, { equipmentId: 123 }]) {
      const res = await t.http().post('/v1/loans').set('Authorization', `Bearer ${u.token}`).send(corpo);
      expect(res.status).toBe(400);
      expect(res.type).toBe('application/problem+json');
    }
    const semCorpo = await t.http().post('/v1/loans').set('Authorization', `Bearer ${u.token}`);
    expect(semCorpo.status).toBe(400);
    expect(await abertos(u.id)).toBe(0);
    expect(await auditorias()).toBe(antes);
  });

  it('CA-18: cada abertura grava loan.open com ator, tenant e recurso; recusa nao grava', async () => {
    const u = await t.criarUsuario('A');
    const e = await t.criarEquipamento('A');
    const res = await pedir(u, e.id);
    const linhas = await t.prisma.auditLog.findMany({ where: { resourceId: res.body.id } });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      action: 'loan.open',
      resourceType: 'loan',
      tenantId: t.tenantA,
      actorUserId: u.id,
    });
    const antes = await auditorias();
    expect((await pedir(u, e.id)).status).toBe(409); // ja emprestado (a ele mesmo)
    expect(await auditorias()).toBe(antes);
  });

  describe('GET /v1/loans/mine', () => {
    const meus = (u: Usuario, query: object = {}) =>
      t.http().get('/v1/loans/mine').query(query).set('Authorization', `Bearer ${u.token}`);

    it('CA-15: devolve so os abertos da pessoa, por dueAt crescente, com state e contagem; de outra pessoa nao aparece', async () => {
      const eu = await t.criarUsuario('A');
      const outra = await t.criarUsuario('A');
      const a = await t.criarEquipamento('A', { name: 'Item A', patrimonio: 'M-0001' });
      const b = await t.criarEquipamento('A', { name: 'Item B', patrimonio: 'M-0002' });
      const c = await t.criarEquipamento('A', { name: 'Item C', patrimonio: 'M-0003' });
      const dela = await t.criarEquipamento('A');
      await t.semearEmprestimo({ userId: eu.id, equipmentId: a.id, dueAt: '2026-11-25' });
      await t.semearEmprestimo({ userId: eu.id, equipmentId: b.id, dueAt: '2026-11-08' });
      await t.semearEmprestimo({ userId: eu.id, equipmentId: c.id, dueAt: '2026-11-09' });
      await t.semearEmprestimo({ userId: outra.id, equipmentId: dela.id, dueAt: '2026-11-01' });

      const res = await meus(eu);
      expect(res.status).toBe(200);
      const nomes = res.body.items.map((i: { equipment: { name: string } }) => i.equipment.name);
      expect(nomes).toEqual(['Item B', 'Item C', 'Item A']);
      expect(res.body.items.map((i: { state: string }) => i.state)).toEqual(['EM_ATRASO', 'EM_DIA', 'EM_DIA']);
      expect(res.body.items[0]).toMatchObject({
        dueAt: '2026-11-08',
        equipment: { id: b.id, name: 'Item B', patrimonio: 'M-0002', category: 'ACESSORIO', imageUrl: null },
      });
      expect(Object.keys(res.body.items[0]).sort()).toEqual(['dueAt', 'equipment', 'id', 'openedAt', 'openedOn', 'state']);
      expect(res.body.items[0].openedOn).toBe('2026-11-09'); // relogio do teste: 12:00 em Brasilia
      expect(res.body).toMatchObject({ openLoans: 3, maxLoans: 3, nextCursor: null });
      expect(JSON.stringify(res.body)).not.toContain(outra.id);
    });

    it('CA-15: a pessoa com papel OPERACOES tambem ve so os proprios emprestimos', async () => {
      const ops = await t.criarUsuario('A', 'OPERACOES');
      const outra = await t.criarUsuario('A');
      const meu = await t.criarEquipamento('A');
      const dela = await t.criarEquipamento('A');
      await t.semearEmprestimo({ userId: ops.id, equipmentId: meu.id, dueAt: '2026-11-20' });
      await t.semearEmprestimo({ userId: outra.id, equipmentId: dela.id, dueAt: '2026-11-20' });
      const res = await meus(ops);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].equipment.id).toBe(meu.id);
    });

    it('CA-15: sem emprestimo devolve lista vazia e openLoans 0; o cursor percorre sem repetir', async () => {
      const vazio = await t.criarUsuario('A');
      expect((await meus(vazio)).body).toMatchObject({ items: [], openLoans: 0, maxLoans: 3, nextCursor: null });

      const u = await t.criarUsuario('A');
      const ids: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const e = await t.criarEquipamento('A');
        // mesmo dueAt nos tres: o desempate e por id
        const loan = await t.semearEmprestimo({ userId: u.id, equipmentId: e.id, dueAt: '2026-11-20' });
        ids.push(loan.id);
      }
      const p1 = await meus(u, { limit: 2 });
      expect(p1.body.items).toHaveLength(2);
      expect(p1.body.nextCursor).not.toBeNull();
      const p2 = await meus(u, { limit: 2, cursor: p1.body.nextCursor });
      expect(p2.body.items).toHaveLength(1);
      expect(p2.body.nextCursor).toBeNull();
      const vistos = [...p1.body.items, ...p2.body.items].map((i: { id: string }) => i.id);
      expect(new Set(vistos)).toEqual(new Set(ids));
      expect((await meus(u, { cursor: 'invalido' })).status).toBe(400);
    });

    it('CA-13: emprestimo da mesma pessoa em outro tenant nao aparece', async () => {
      const u = await t.criarUsuario('A');
      await t.prisma.membership.create({ data: { userId: u.id, tenantId: t.tenantB, role: 'COLABORADOR' } });
      const doB = await t.criarEquipamento('B', { name: 'Item do B' });
      await t.semearEmprestimo({ userId: u.id, equipmentId: doB.id, tenantId: t.tenantB, dueAt: '2026-11-20' });
      const res = await meus(u);
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.openLoans).toBe(0);
    });

    it('CA-14: sem token e 401; sem vinculo ou so com outro tenant e 403', async () => {
      expect((await t.http().get('/v1/loans/mine')).status).toBe(401);
      for (const u of [await t.criarUsuario(null), await t.criarUsuario('B')]) {
        const res = await meus(u);
        expect(res.status).toBe(403);
        expect(res.type).toBe('application/problem+json');
      }
    });
  });
});
