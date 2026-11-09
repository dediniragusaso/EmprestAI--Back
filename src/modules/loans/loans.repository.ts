import { Injectable } from '@nestjs/common';
import { Prisma, type EquipmentStatus } from '@prisma/client';
import { dateOnly } from '../../common/clock';
import type { CursorEmprestimo } from './loans.schemas';
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

  /**
   * R9(b): serializa os pedidos da mesma pessoa. Lock de TRANSACAO (liberado no commit/rollback;
   * compativel com o pooler em modo transacao). Deve ser o primeiro lock da transacao: a ordem de
   * lock e sempre pessoa -> equipamento, para nao haver deadlock.
   */
  async travarPessoa(tx: Prisma.TransactionClient, tenantId: string, userId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId} || ':' || ${userId}, 0))`;
  }

  /**
   * Equipamento do tenant, com a linha TRAVADA (`FOR UPDATE`) ate o fim da transacao (R9(a)): o
   * segundo pedido espera e le o status ja mudado. Outro tenant ou id inexistente: null.
   */
  async buscarEquipamentoTravado(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    const linhas = await tx.$queryRaw<
      { id: string; name: string; patrimonio: string | null; status: EquipmentStatus }[]
    >`SELECT id::text AS id, name, patrimonio, status::text AS status
        FROM equipment
       WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
         FOR UPDATE`;
    return linhas[0] ?? null;
  }

  /** O `INSERT` violou o indice unico parcial `loans_one_open_per_equipment`? (rede de seguranca, R9) */
  static violouUmAbertoPorEquipamento(erro: unknown): boolean {
    return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
  }

  /** Uma pagina dos emprestimos ABERTOS da pessoa (limit + 1 linhas), por dueAt crescente e id. */
  listarAbertosDaPessoa(tenantId: string, userId: string, limit: number, cursor?: CursorEmprestimo) {
    const depois = cursor
      ? {
          OR: [
            { dueAt: { gt: dateOnly(cursor.d) } },
            { dueAt: dateOnly(cursor.d), id: { gt: cursor.i } },
          ],
        }
      : {};
    return this.prisma.loan.findMany({
      where: { tenantId, userId, returnedAt: null, ...depois },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: {
        equipment: { select: { id: true, name: true, patrimonio: true, category: true, imageUrl: true } },
      },
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
