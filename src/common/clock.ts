// Fatia 003, R8 e Q2: "hoje", atraso e prazo são do servidor, na data civil de America/Sao_Paulo.
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export const TIMEZONE = 'America/Sao_Paulo';

/** Data civil `YYYY-MM-DD` de um instante, em America/Sao_Paulo. */
export function todayInSaoPaulo(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts; // en-CA formata como YYYY-MM-DD
}

/** Soma `n` dias corridos a uma data civil `YYYY-MM-DD` (sem horário de verão: aritmética em UTC). */
export function addDays(dateISO: string, n: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Converte `YYYY-MM-DD` em Date à meia-noite UTC, para colunas `date` do Prisma. */
export function dateOnly(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`);
}
