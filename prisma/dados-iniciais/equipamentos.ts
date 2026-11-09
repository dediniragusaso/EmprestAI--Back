// Spec 002-dados-iniciais, R1, R3 e R5: grava os equipamentos do tenant, repetivel.
import type { PrismaClient } from '@prisma/client';
import type { ItemEquipamento } from './dados';

export interface ResumoEquipamentos {
  criados: number;
  atualizados: number;
}

/** R3: URL publica do bucket `imagens` (decisao do operador), caminho fixo por patrimonio. */
export function montarImageUrl(supabaseUrl: string, patrimonio: string): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/imagens/equipamentos/${patrimonio}.jpg`;
}

/**
 * Upsert por (tenantId, patrimonio).
 * - create: todos os campos, inclusive `status` (so a criacao decide a situacao).
 * - update: name, category e campos de imagem; NUNCA `status` (R5, CA-13), porque o status passa
 *   a mudar com os emprestimos e reescreve-lo devolveria item EMPRESTADO para DISPONIVEL.
 * `observacao` nao e tocada (Q5: fica vazia).
 */
export async function gravarEquipamentos(
  prisma: PrismaClient,
  tenantId: string,
  itens: ItemEquipamento[],
  supabaseUrl: string,
): Promise<ResumoEquipamentos> {
  const existentes = new Set(
    (await prisma.equipment.findMany({ where: { tenantId }, select: { patrimonio: true } })).map(
      (e) => e.patrimonio,
    ),
  );

  await prisma.$transaction(
    itens.map((item) => {
      const imagem = {
        imageUrl: montarImageUrl(supabaseUrl, item.patrimonio),
        imagePixabayId: item.imagePixabayId,
        imageAuthor: item.imageAuthor,
        imagePageUrl: item.imagePageUrl,
        imageLicense: item.imageLicense,
      };
      return prisma.equipment.upsert({
        where: { tenantId_patrimonio: { tenantId, patrimonio: item.patrimonio } },
        create: {
          tenantId,
          patrimonio: item.patrimonio,
          name: item.nome,
          category: item.categoria,
          status: item.status,
          ...imagem,
        },
        update: { name: item.nome, category: item.categoria, status: item.status, ...imagem, updatedAt: new Date() },
      });
    }),
  );

  const atualizados = itens.filter((i) => existentes.has(i.patrimonio)).length;
  return { criados: itens.length - atualizados, atualizados };
}
