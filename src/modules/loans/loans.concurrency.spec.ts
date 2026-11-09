import { subirAppDeTeste, type AppDeTeste, type Usuario } from '../../testing/app';
import { LoansModule } from './loans.module';

jest.setTimeout(480_000);

const REPETICOES = 20;

// Fatia 003, T9. R9: concorrencia provada em Postgres real, repetida para a corrida nao passar por sorte.
describe('POST /v1/loans, concorrencia', () => {
  let t: AppDeTeste;

  beforeAll(async () => {
    t = await subirAppDeTeste({ modulos: [LoansModule] });
  });

  afterAll(async () => {
    await t?.parar();
  });

  const pedir = (u: Usuario, equipmentId: string) =>
    t.http().post('/v1/loans').set('Authorization', `Bearer ${u.token}`).send({ equipmentId });

  const codigos = (rs: { status: number; body: { code?: string } }[]) =>
    rs.map((r) => (r.status === 201 ? 'ok' : `${r.status}:${r.body.code ?? '-'}`)).sort();

  it(`CA-10: 10 pessoas pedem o mesmo equipamento ao mesmo tempo (${REPETICOES}x): 1 sucesso, 9 recusas, 1 loan`, async () => {
    for (let r = 0; r < REPETICOES; r += 1) {
      // Pessoas novas a cada repeticao: quem ganha acumula emprestimo e, depois de 3, cairia no limite.
      const pessoas: Usuario[] = [];
      for (let i = 0; i < 10; i += 1) pessoas.push(await t.criarUsuario('A'));
      const e = await t.criarEquipamento('A');
      const respostas = await Promise.all(pessoas.map((p) => pedir(p, e.id)));
      expect(codigos(respostas)).toEqual([...Array(9).fill('409:equipment-already-loaned'), 'ok'].sort());
      expect(await t.prisma.loan.count({ where: { equipmentId: e.id, returnedAt: null } })).toBe(1);
      expect((await t.prisma.equipment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('EMPRESTADO');
    }
  });

  it(`CA-11: uma pessoa com 0 emprestimos faz 5 pedidos simultaneos (${REPETICOES}x): exatamente 3 sucessos e 2 recusas por limite`, async () => {
    for (let r = 0; r < REPETICOES; r += 1) {
      const u = await t.criarUsuario('A');
      const itens = [];
      for (let i = 0; i < 5; i += 1) itens.push(await t.criarEquipamento('A'));
      const respostas = await Promise.all(itens.map((e) => pedir(u, e.id)));
      expect(codigos(respostas)).toEqual(['409:loan-limit-reached', '409:loan-limit-reached', 'ok', 'ok', 'ok']);
      expect(await t.prisma.loan.count({ where: { userId: u.id, returnedAt: null } })).toBe(3);
    }
  });

  it(`CA-11: com 2 abertos e 3 pedidos simultaneos (${REPETICOES}x): 1 sucesso e 2 recusas por limite`, async () => {
    for (let r = 0; r < REPETICOES; r += 1) {
      const u = await t.criarUsuario('A');
      for (let i = 0; i < 2; i += 1) {
        const e = await t.criarEquipamento('A');
        await t.semearEmprestimo({ userId: u.id, equipmentId: e.id, dueAt: '2026-11-20' });
      }
      const itens = [];
      for (let i = 0; i < 3; i += 1) itens.push(await t.criarEquipamento('A'));
      const respostas = await Promise.all(itens.map((e) => pedir(u, e.id)));
      expect(codigos(respostas)).toEqual(['409:loan-limit-reached', '409:loan-limit-reached', 'ok']);
      expect(await t.prisma.loan.count({ where: { userId: u.id, returnedAt: null } })).toBe(3);
    }
  });

  it('CA-12: com o banco inconsistente (DISPONIVEL com loan aberto) o pedido e 409 equipment-already-loaned, nao 500', async () => {
    const dono = await t.criarUsuario('A');
    const outra = await t.criarUsuario('A');
    const e = await t.criarEquipamento('A');
    // Inconsistencia deliberada: loan aberto por SQL direto, sem passar o equipamento para EMPRESTADO.
    await t.prisma.loan.create({
      data: { tenantId: t.tenantA, equipmentId: e.id, userId: dono.id, dueAt: new Date('2026-11-20T00:00:00Z') },
    });
    const res = await pedir(outra, e.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('equipment-already-loaned');
    expect(await t.prisma.loan.count({ where: { equipmentId: e.id, returnedAt: null } })).toBe(1);
    expect((await t.prisma.equipment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe('DISPONIVEL');
  });
});
