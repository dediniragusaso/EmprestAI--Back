import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

// Corpo do POST /v1/loans. Campos desconhecidos (ex.: tenantId) sao descartados, nunca usados (R1).
const abrirSchema = z.object({ equipmentId: z.string().uuid() });

export function lerCorpoAbrir(body: unknown): { equipmentId: string } {
  const r = abrirSchema.safeParse(body ?? {});
  if (!r.success) throw new BadRequestException('Informe equipmentId (uuid) do equipamento.');
  return r.data;
}

// GET /v1/loans/mine: lista paginada por cursor (ADR-001 §4, Q11), por dueAt crescente e id.
const queryMeusSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
});

export interface CursorEmprestimo {
  /** dueAt do ultimo item da pagina (YYYY-MM-DD) */
  d: string;
  /** id do ultimo item da pagina */
  i: string;
}

const cursorEmprestimoSchema = z.object({ d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), i: z.string().uuid() });

export function codificarCursorEmprestimo(c: CursorEmprestimo): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function lerQueryMeus(query: unknown): { limit: number; cursor?: CursorEmprestimo } {
  const r = queryMeusSchema.safeParse(query);
  if (!r.success) throw new BadRequestException('Parametros invalidos: limit (1 a 100) ou cursor.');
  if (!r.data.cursor) return { limit: r.data.limit };
  try {
    const bruto: unknown = JSON.parse(Buffer.from(r.data.cursor, 'base64url').toString('utf8'));
    return { limit: r.data.limit, cursor: cursorEmprestimoSchema.parse(bruto) };
  } catch {
    throw new BadRequestException('Cursor invalido.');
  }
}

export interface MeuEmprestimoDto {
  id: string;
  equipment: {
    id: string;
    name: string;
    patrimonio: string | null;
    category: string;
    imageUrl: string | null;
  };
  openedAt: string;
  /** Data civil da retirada (YYYY-MM-DD, America/Sao_Paulo). */
  openedOn: string;
  dueAt: string;
  state: 'EM_DIA' | 'EM_ATRASO';
}

export interface MeusEmprestimosDto {
  items: MeuEmprestimoDto[];
  nextCursor: string | null;
  openLoans: number;
  maxLoans: number;
}
