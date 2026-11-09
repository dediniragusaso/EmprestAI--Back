// Spec 002-dados-iniciais, CA-10: as migrations aplicam do zero num Postgres descartavel.
// O teste nao exercita a FK nem o trigger do Auth: a `init` so os cria se o schema `auth` existir.
import { Prisma } from '@prisma/client';
import { subirBanco, type BancoDeTeste } from './dados-iniciais/banco-teste';

jest.setTimeout(240_000);

describe('migrations em Postgres descartavel', () => {
  let banco: BancoDeTeste & { migrations: string[] };

  beforeAll(async () => {
    banco = await subirBanco();
  });
  afterAll(async () => {
    await banco?.parar();
  });

  it('CA-10: aplica as migrations do zero, em ordem, e equipment ganha as cinco colunas de imagem', async () => {
    expect(banco.migrations).toEqual(['20261019123948_init', '20261109150000_equipment_image']);
    const colunas = await banco.prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'equipment' AND column_name LIKE 'image_%'
      ORDER BY column_name`);
    expect(colunas.map((c) => c.column_name)).toEqual([
      'image_author',
      'image_license',
      'image_page_url',
      'image_pixabay_id',
      'image_url',
    ]);
  });

  it('CA-10: (tenantId, imagePixabayId) repetido no mesmo tenant e recusado; itens sem foto nao colidem', async () => {
    const tenant = await banco.prisma.tenant.create({ data: { slug: 'ca10', name: 'CA-10' } });
    await banco.prisma.equipment.create({
      data: { tenantId: tenant.id, name: 'A', category: 'NOTEBOOK', patrimonio: 'TI-9001', imagePixabayId: 7 },
    });
    // Sem foto: o Postgres nao colide NULL, entao dois itens sem imagePixabayId convivem.
    await banco.prisma.equipment.create({
      data: { tenantId: tenant.id, name: 'B', category: 'CABO', patrimonio: 'TI-9002' },
    });
    await banco.prisma.equipment.create({
      data: { tenantId: tenant.id, name: 'C', category: 'CABO', patrimonio: 'TI-9003' },
    });
    await expect(
      banco.prisma.equipment.create({
        data: { tenantId: tenant.id, name: 'D', category: 'MONITOR', patrimonio: 'TI-9004', imagePixabayId: 7 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
