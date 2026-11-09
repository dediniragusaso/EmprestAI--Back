// Spec 002-dados-iniciais: equipamentos, creditos, idempotencia e `status` preservado.
// Dados reais de equipamentos.json e creditos.json; banco = Postgres descartavel (Testcontainers).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { subirBanco, type BancoDeTeste } from './banco-teste';
import { lerItens } from './dados';
import { gravarEquipamentos, montarImageUrl } from './equipamentos';

jest.setTimeout(240_000);

const SUPABASE_URL = 'http://127.0.0.1:54321';
const PASTA = path.resolve(__dirname, '..', '..', 'scripts', 'imagens-equipamentos');
const lerJson = (nome: string) => JSON.parse(readFileSync(path.join(PASTA, nome), 'utf8'));

describe('dados iniciais: equipamentos', () => {
  let bd: BancoDeTeste;
  const itens = lerItens();
  let contador = 0;

  async function novoTenant() {
    contador += 1;
    return bd.prisma.tenant.create({ data: { slug: `t${contador}`, name: `Tenant ${contador}` } });
  }

  beforeAll(async () => {
    bd = await subirBanco();
  });
  afterAll(async () => {
    await bd?.parar();
  });

  it('CA-01: grava exatamente 12 equipamentos com nomes, categorias e situacoes da lista', async () => {
    const tenant = await novoTenant();
    await gravarEquipamentos(bd.prisma, tenant.id, itens, SUPABASE_URL);

    const linhas = await bd.prisma.equipment.findMany({ where: { tenantId: tenant.id }, orderBy: { patrimonio: 'asc' } });
    expect(linhas).toHaveLength(12);
    expect(linhas.map((l) => l.patrimonio)).toEqual(Array.from({ length: 12 }, (_v, i) => `TI-${String(i + 1).padStart(4, '0')}`));

    const lista = lerJson('equipamentos.json') as Array<{ patrimonio: string; nome: string; categoria: string; situacao: string }>;
    for (const e of lista) {
      const linha = linhas.find((l) => l.patrimonio === e.patrimonio);
      expect(linha?.name).toBe(e.nome);
      expect(linha?.category).toBe(e.categoria.toUpperCase());
      expect(linha?.status).toBe(e.situacao === 'manutencao' ? 'MANUTENCAO' : 'DISPONIVEL');
    }
    expect(linhas.filter((l) => l.status === 'MANUTENCAO').map((l) => l.patrimonio)).toEqual(['TI-0004', 'TI-0007', 'TI-0010']);
    expect(linhas.filter((l) => l.status === 'DISPONIVEL')).toHaveLength(9);
    expect(linhas.filter((l) => l.status === 'EMPRESTADO')).toHaveLength(0);
    expect(await bd.prisma.loan.count({ where: { tenantId: tenant.id } })).toBe(0);
  });

  it('CA-02: a imageUrl segue o formato do bucket publico imagens, sem barra duplicada', async () => {
    const tenant = await novoTenant();
    await gravarEquipamentos(bd.prisma, tenant.id, itens, `${SUPABASE_URL}/`);
    const linhas = await bd.prisma.equipment.findMany({ where: { tenantId: tenant.id } });
    for (const l of linhas) {
      expect(l.imageUrl).toBe(`${SUPABASE_URL}/storage/v1/object/public/imagens/equipamentos/${l.patrimonio}.jpg`);
    }
    expect(montarImageUrl('https://x.supabase.co//', 'TI-0001')).toBe(
      'https://x.supabase.co/storage/v1/object/public/imagens/equipamentos/TI-0001.jpg',
    );
  });

  it('CA-03: creditos iguais ao creditos.json, fotos distintas, e o banco recusa foto repetida no mesmo tenant', async () => {
    const tenant = await novoTenant();
    await gravarEquipamentos(bd.prisma, tenant.id, itens, SUPABASE_URL);
    const linhas = await bd.prisma.equipment.findMany({ where: { tenantId: tenant.id } });
    const creditos = lerJson('creditos.json') as Array<{ patrimonio: string; pixabayId: number; autor: string; pageURL: string; licenca: string }>;

    expect(new Set(linhas.map((l) => l.imagePixabayId)).size).toBe(12);
    for (const c of creditos) {
      const linha = linhas.find((l) => l.patrimonio === c.patrimonio);
      expect(linha?.imagePixabayId).toBe(c.pixabayId);
      expect(linha?.imageAuthor).toBe(c.autor);
      expect(linha?.imagePageUrl).toBe(c.pageURL);
      expect(linha?.imageLicense).toBe(c.licenca);
    }

    // Mesmo tenant: recusado. Outro tenant: aceito (unique por tenant, Q2).
    await expect(
      bd.prisma.equipment.create({
        data: { tenantId: tenant.id, name: 'Repetido', category: 'CABO', patrimonio: 'TI-9999', imagePixabayId: linhas[0].imagePixabayId },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    const outro = await novoTenant();
    await expect(
      bd.prisma.equipment.create({
        data: { tenantId: outro.id, name: 'Outro tenant', category: 'CABO', patrimonio: 'TI-9999', imagePixabayId: linhas[0].imagePixabayId },
      }),
    ).resolves.toBeDefined();
  });

  it('CA-04: rodar duas vezes nao duplica: 12 equipamentos e a segunda execucao so atualiza', async () => {
    const tenant = await novoTenant();
    const primeira = await gravarEquipamentos(bd.prisma, tenant.id, itens, SUPABASE_URL);
    const segunda = await gravarEquipamentos(bd.prisma, tenant.id, itens, SUPABASE_URL);
    expect(primeira).toEqual({ criados: 12, atualizados: 0 });
    expect(segunda).toEqual({ criados: 0, atualizados: 12 });
    expect(await bd.prisma.equipment.count({ where: { tenantId: tenant.id } })).toBe(12);
  });

  it('CA-13: equipamento existente tem name, category e imagem restaurados, mas o status nunca muda', async () => {
    const tenant = await novoTenant();
    await gravarEquipamentos(bd.prisma, tenant.id, itens, SUPABASE_URL);
    const antes = await bd.prisma.equipment.findFirstOrThrow({ where: { tenantId: tenant.id, patrimonio: 'TI-0001' } });

    // TI-0001 nasceu DISPONIVEL. Simula emprestimo e adultera nome, categoria e imagem.
    await bd.prisma.equipment.update({
      where: { id: antes.id },
      data: { status: 'EMPRESTADO', name: 'Adulterado', category: 'CABO', imageUrl: 'x', imageAuthor: 'x' },
    });
    // TI-0004 nasceu MANUTENCAO e fica DISPONIVEL: o script tambem nao o "corrige".
    await bd.prisma.equipment.updateMany({ where: { tenantId: tenant.id, patrimonio: 'TI-0004' }, data: { status: 'DISPONIVEL' } });

    await gravarEquipamentos(bd.prisma, tenant.id, itens, SUPABASE_URL);
    const depois = await bd.prisma.equipment.findFirstOrThrow({ where: { id: antes.id } });
    expect(depois.status).toBe('EMPRESTADO');
    expect(depois.name).toBe(antes.name);
    expect(depois.category).toBe(antes.category);
    expect(depois.imageUrl).toBe(antes.imageUrl);
    expect(depois.imageAuthor).toBe(antes.imageAuthor);
    const t4 = await bd.prisma.equipment.findFirstOrThrow({ where: { tenantId: tenant.id, patrimonio: 'TI-0004' } });
    expect(t4.status).toBe('DISPONIVEL');
  });
});
