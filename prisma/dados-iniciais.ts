// Dados iniciais (spec 002-dados-iniciais): equipamentos do tenant `suporte_ti`, com foto e credito.
// Uso: npm run db:dados-iniciais
// O seed existente (prisma/seed.ts) nao muda e continua so criando o tenant (R9).
import { PrismaClient } from '@prisma/client';
import { lerItens } from './dados-iniciais/dados';
import { executarDadosIniciais } from './dados-iniciais/principal';

async function main() {
  const itens = lerItens();
  const prisma = new PrismaClient();
  try {
    const resumo = await executarDadosIniciais({ prisma, env: process.env, itens });
    console.log(
      `equipamentos: ${resumo.equipamentos.criados} criados, ${resumo.equipamentos.atualizados} atualizados`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : 'falha desconhecida');
  process.exitCode = 1;
});
