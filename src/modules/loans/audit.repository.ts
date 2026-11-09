import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// Auditoria append-only (modelagem §4.6; ADR-001 §10). So insere; o trigger do banco barra UPDATE/DELETE.
// Fica numa classe propria para o teste do CA-06 poder fazer a gravacao falhar.
@Injectable()
export class AuditRepository {
  async registrar(
    tx: Prisma.TransactionClient,
    dados: { tenantId: string; actorUserId: string; action: string; resourceType: string; resourceId: string },
  ): Promise<void> {
    await tx.auditLog.create({ data: dados });
  }
}
