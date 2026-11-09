import { HttpException, HttpStatus } from '@nestjs/common';
import { MAX_OPEN_LOANS } from './loan-rules';

export type LoanRefusalCode =
  | 'equipment-unavailable'
  | 'equipment-already-loaned'
  | 'loan-overdue'
  | 'loan-limit-reached';

// Spec 003, R7: toda recusa e HTTP 409 em Problem Details, com `code` estavel e `detail` em texto.
// As frases partem dos rotulos da ADR-003 §7 (Q4, decidido pelo operador em 09/11/2026).
export const MENSAGENS_RECUSA: Record<LoanRefusalCode | 'equipment-already-yours', string> = {
  'equipment-unavailable': 'Indisponível: este equipamento está em manutenção.',
  'equipment-already-loaned': 'Emprestado: outra pessoa acabou de ficar com este equipamento.',
  'equipment-already-yours': 'Está com você.',
  'loan-overdue': 'Bloqueado por atraso: devolva o item vencido antes de pedir outro.',
  'loan-limit-reached': `Limite de ${MAX_OPEN_LOANS} itens: devolva um item antes de pedir outro.`,
};

export class LoanRefusalException extends HttpException {
  constructor(code: LoanRefusalCode, mensagem: string = MENSAGENS_RECUSA[code]) {
    super({ code, message: mensagem }, HttpStatus.CONFLICT);
  }
}
