import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CursorEquipamento, ItemEquipamentoDto } from './equipment.schemas';

interface Linha {
  id: string;
  patrimonio: string | null;
  name: string;
  category: string;
  status: ItemEquipamentoDto['status'];
  image_url: string | null;
  due_at: Date | null;
  is_mine: boolean | null;
}

// Ordem fixa: patrimonio crescente, itens sem patrimonio por ultimo, desempate por id (R2).
// Todo SQL leva tenant_id do contexto (ADR-001 §6).
@Injectable()
export class EquipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Uma pagina do catalogo (limit + 1 linhas, para o service saber se ha proxima). */
  async listar(
    tenantId: string,
    userId: string,
    limit: number,
    cursor?: CursorEquipamento,
  ): Promise<ItemEquipamentoDto[]> {
    let depois = Prisma.empty;
    if (cursor) {
      depois =
        cursor.p === null
          ? Prisma.sql`AND e.patrimonio IS NULL AND e.id > ${cursor.i}::uuid`
          : Prisma.sql`AND (e.patrimonio > ${cursor.p} OR (e.patrimonio = ${cursor.p} AND e.id > ${cursor.i}::uuid) OR e.patrimonio IS NULL)`;
    }
    const linhas = await this.prisma.$queryRaw<Linha[]>`
      SELECT e.id::text AS id, e.patrimonio, e.name, e.category::text AS category,
             e.status::text AS status, e.image_url, l.due_at, (l.user_id = ${userId}::uuid) AS is_mine
        FROM equipment e
        LEFT JOIN loans l
          ON l.equipment_id = e.id AND l.tenant_id = e.tenant_id AND l.returned_at IS NULL
       WHERE e.tenant_id = ${tenantId}::uuid ${depois}
       ORDER BY e.patrimonio ASC NULLS LAST, e.id ASC
       LIMIT ${limit + 1}`;
    return linhas.map((l) => ({
      id: l.id,
      patrimonio: l.patrimonio,
      name: l.name,
      category: l.category,
      status: l.status,
      imageUrl: l.image_url,
      loan: l.due_at ? { dueAt: l.due_at.toISOString().slice(0, 10), isMine: l.is_mine === true } : null,
    }));
  }
}
