import { addDays, dateOnly, SystemClock, todayInSaoPaulo } from './clock';

// Fatia 003, T3. CA-16: "hoje" e prazo vêm do servidor, em America/Sao_Paulo.
describe('clock', () => {
  it('CA-16: 23:59 em Brasília ainda é o mesmo dia (02:59 UTC do dia seguinte)', () => {
    expect(todayInSaoPaulo(new Date('2026-11-10T02:59:00.000Z'))).toBe('2026-11-09');
  });

  it('CA-16: 00:01 em Brasília já é o dia seguinte (03:01 UTC)', () => {
    expect(todayInSaoPaulo(new Date('2026-11-10T03:01:00.000Z'))).toBe('2026-11-10');
  });

  it('CA-16: prazo é hoje + 14 dias corridos, atravessando mês e ano', () => {
    expect(addDays('2026-11-09', 14)).toBe('2026-11-23');
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08');
    expect(addDays('2028-02-20', 14)).toBe('2028-03-05');
  });

  it('CA-16: dateOnly guarda a data civil como meia-noite UTC (coluna date)', () => {
    expect(dateOnly('2026-11-23').toISOString()).toBe('2026-11-23T00:00:00.000Z');
  });

  it('SystemClock devolve o instante atual', () => {
    const antes = Date.now();
    const t = new SystemClock().now().getTime();
    expect(t).toBeGreaterThanOrEqual(antes);
  });
});
