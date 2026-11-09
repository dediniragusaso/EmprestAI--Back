import { ArgumentsHost, ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { ProblemDetailsFilter } from './problem-details.filter';

function run(exception: unknown) {
  const res = { status: jest.fn().mockReturnThis(), type: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  new ProblemDetailsFilter().catch(exception, host);
  return { res, body: res.json.mock.calls[0][0] as Record<string, unknown> };
}

// Fatia 003, T4. CA-07, CA-08, CA-09, CA-10: a recusa leva `code` estável (RFC 9457).
describe('ProblemDetailsFilter', () => {
  it('CA-07: repassa o code e o detail de uma recusa 409', () => {
    const { res, body } = run(
      new ConflictException({ code: 'loan-limit-reached', message: 'Limite de 3 itens: devolva um item antes de pedir outro.' }),
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.type).toHaveBeenCalledWith('application/problem+json');
    expect(body).toMatchObject({
      status: 409,
      code: 'loan-limit-reached',
      detail: 'Limite de 3 itens: devolva um item antes de pedir outro.',
    });
  });

  it('sem code, o corpo continua como antes (sem a chave code)', () => {
    const { body } = run(new NotFoundException('Equipamento nao encontrado.'));
    expect(body).toEqual({ type: 'about:blank', title: 'NOT_FOUND', status: 404, detail: 'Equipamento nao encontrado.' });
    expect('code' in body).toBe(false);
  });

  it('erro 5xx não expõe code nem a mensagem', () => {
    const { body } = run(new HttpException({ code: 'segredo', message: 'falha interna com dado' }, 500));
    expect(body.detail).toBe('Erro interno.');
    expect('code' in body).toBe(false);
  });

  it('exceção desconhecida vira 500 genérico', () => {
    const { body } = run(new Error('conexao postgres://u:senha@host'));
    expect(body).toMatchObject({ status: 500, detail: 'Erro interno.' });
    expect(JSON.stringify(body)).not.toContain('senha');
  });
});
