import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

// Corpo do POST /v1/loans. Campos desconhecidos (ex.: tenantId) sao descartados, nunca usados (R1).
const abrirSchema = z.object({ equipmentId: z.string().uuid() });

export function lerCorpoAbrir(body: unknown): { equipmentId: string } {
  const r = abrirSchema.safeParse(body ?? {});
  if (!r.success) throw new BadRequestException('Informe equipmentId (uuid) do equipamento.');
  return r.data;
}
