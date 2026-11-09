import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

// Spec 003, R2 e Q11: lista paginada por cursor (ADR-001 §4). Entrada validada com Zod.
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
});

export interface CursorEquipamento {
  /** patrimonio do ultimo item da pagina (null quando o item nao tem patrimonio) */
  p: string | null;
  /** id do ultimo item da pagina */
  i: string;
}

const cursorSchema = z.object({ p: z.string().nullable(), i: z.string().uuid() });

export function codificarCursor(c: CursorEquipamento): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodificarCursor(texto: string): CursorEquipamento {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(texto, 'base64url').toString('utf8')));
  } catch {
    throw new BadRequestException('Cursor invalido.');
  }
}

export function lerQuery(query: unknown): { limit: number; cursor?: CursorEquipamento } {
  const r = querySchema.safeParse(query);
  if (!r.success) throw new BadRequestException('Parametros invalidos: limit (1 a 100) ou cursor.');
  return { limit: r.data.limit, cursor: r.data.cursor ? decodificarCursor(r.data.cursor) : undefined };
}

export interface ItemEquipamentoDto {
  id: string;
  patrimonio: string | null;
  name: string;
  category: string;
  status: 'DISPONIVEL' | 'EMPRESTADO' | 'MANUTENCAO';
  imageUrl: string | null;
  /** So em item EMPRESTADO. Nunca traz nome nem e-mail de quem esta com o item (Q3). */
  loan: { dueAt: string; isMine: boolean } | null;
}

export interface ViewerDto {
  openLoans: number;
  maxLoans: number;
  overdue: boolean;
  today: string;
  proposedDueAt: string;
}

export interface CatalogoDto {
  items: ItemEquipamentoDto[];
  nextCursor: string | null;
  viewer: ViewerDto;
}
