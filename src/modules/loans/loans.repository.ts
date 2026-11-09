import { Injectable } from '@nestjs/common';
import type { EquipmentStatus, Prisma } from '@prisma/client';
import { dateOnly } from '../../common/clock';
import { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

// Repository (ADR-001 §3): so ele fala com o Prisma. Toda consulta leva `tenantId` do contexto.
@Injectable()
export class LoansRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Quantos emprestimos abertos a pessoa tem no tenant. */
  contarAbertos(tenantId: string, userId: string, db: Db = this.prisma): Promise<number> {
    return db.loan.count({ where: { tenantId, userId, returnedAt: null } });
  }

  /** A pessoa tem emprestimo aberto com `dueAt` anterior a `hoje` (YYYY-MM-DD)? `dueAt` = hoje nao e atraso. */
  async temAtraso(tenantId: string, userId: string, hoje: string, db: Db = this.prisma): Promise<boolean> {
    const n = await db.loan.count({
      where: { tenantId, userId, returnedAt: null, dueAt: { lt: dateOnly(hoje) } },
    });
    return n > 0;
  }

  /** Equipamento do tenant (outro tenant ou id inexistente: null). */
  buscarEquipamento(db: Db, tenantId: string, id: string) {
    return db.equipment.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, patrimonio: true, status: true },
    });
  }

  /** Dono do emprestimo aberto do equipamento, se houver. */
  buscarEmprestimoAberto(db: Db, tenantId: string, equipmentId: string) {
    return db.loan.findFirst({ where: { tenantId, equipmentId, returnedAt: null }, select: { userId: true } });
  }

  inserir(
    db: Db,
    dados: { tenantId: string; equipmentId: string; userId: string; openedAt: Date; dueAt: Date },
  ) {
    return db.loan.create({ data: dados });
  }

  /** DISPONIVEL -> EMPRESTADO. Devolve quantas linhas mudaram (0 = alguem chegou antes). */
  async marcarEmprestado(db: Db, tenantId: string, equipmentId: string): Promise<number> {
    const from: EquipmentStatus = 'DISPONIVEL';
    const r = await db.equipment.updateMany({
      where: { id: equipmentId, tenantId, status: from },
      data: { status: 'EMPRESTADO', updatedAt: new Date() },
    });
    return r.count;
  }
}
