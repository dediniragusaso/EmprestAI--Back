// Dados iniciais (spec 002-dados-iniciais): equipamentos do tenant `suporte_ti`, com foto e credito,
// e o usuario obrigatorio. Uso: npm run db:dados-iniciais
// O seed existente (prisma/seed.ts) nao muda e continua so criando o tenant (R9).
import { PrismaClient } from '@prisma/client';
import { criarClienteAuthAdmin } from './dados-iniciais/auth';
import { lerItens } from './dados-iniciais/dados';
import { conferirDestino } from './dados-iniciais/guarda';
import { executarDadosIniciais } from './dados-iniciais/principal';
import { redigir } from './dados-iniciais/segredos';

const SEGREDOS = [
  process.env.SEED_PROFESSOR_PASSWORD,
  process.env.SEED_TESTE_PASSWORD,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.DATABASE_URL,
  process.env.DIRECT_URL,
];

async function main() {
  // Antes de qualquer leitura ou escrita: destino remoto exige a confirmacao do operador.
  const destino = conferirDestino(process.env);
  console.log(`destino: ${destino.local ? 'LOCAL' : 'REMOTO confirmado pelo operador'} (${[...new Set(destino.hosts)].join(', ')})`);

  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente: a API admin do Auth exige a service_role.');
  const auth = criarClienteAuthAdmin({ supabaseUrl: process.env.SUPABASE_URL as string, serviceRoleKey: chave });

  const itens = lerItens();
  const prisma = new PrismaClient();
  try {
    const r = await executarDadosIniciais({ prisma, auth, env: process.env, itens });
    console.log(`equipamentos: ${r.equipamentos.criados} criados, ${r.equipamentos.atualizados} atualizados`);
    console.log(`professor: ${r.professor.criado ? 'criado no Auth' : 'ja existia no Auth'}; membership COLABORADOR garantida`);
    console.log(`conta de teste: ${r.teste ? (r.teste.criado ? 'criada' : 'ja existia') : 'nao solicitada'}`);
    for (const aviso of r.avisos) console.warn(`aviso: ${aviso}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : 'falha desconhecida';
  console.error(redigir(mensagem, SEGREDOS));
  process.exitCode = 1;
});
