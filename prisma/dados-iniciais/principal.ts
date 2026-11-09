// Spec 002-dados-iniciais: orquestra os dados iniciais. Recebe as dependencias por parametro
// (cliente do Prisma, cliente do Auth, dados e variaveis de ambiente) para ser testavel sem Auth
// nem Supabase.
import type { PrismaClient } from '@prisma/client';
import type { ClienteAuthAdmin } from './auth';
import type { ItemEquipamento } from './dados';
import { gravarEquipamentos, type ResumoEquipamentos } from './equipamentos';
import { garantirUsuario, type ResumoUsuario } from './usuarios';

export const TENANT_SLUG = 'suporte_ti';
export const EMAIL_PROFESSOR = 'marcelo.grilo@institutojef.org.br';

export interface DependenciasDadosIniciais {
  prisma: PrismaClient;
  auth: ClienteAuthAdmin;
  env: Record<string, string | undefined>;
  itens: ItemEquipamento[];
}

export interface ResumoDadosIniciais {
  equipamentos: ResumoEquipamentos;
  professor: ResumoUsuario;
  /** null quando SEED_TESTE_EMAIL e SEED_TESTE_PASSWORD nao estao definidas as duas. */
  teste: ResumoUsuario | null;
  avisos: string[];
}

export async function executarDadosIniciais(deps: DependenciasDadosIniciais): Promise<ResumoDadosIniciais> {
  const { prisma, auth, env, itens } = deps;

  // Q8: tudo que e obrigatorio e conferido ANTES de qualquer escrita e antes de tocar no Auth.
  const supabaseUrl = env.SUPABASE_URL;
  if (!supabaseUrl) throw new Error('SUPABASE_URL ausente: a imageUrl e montada a partir dela.');
  const senhaProfessor = env.SEED_PROFESSOR_PASSWORD;
  if (!senhaProfessor) {
    throw new Error('SEED_PROFESSOR_PASSWORD ausente: o usuario obrigatorio nao pode ser criado.');
  }

  // Q16: o script exige o tenant; quem o cria e o `db:seed`.
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    throw new Error(`Tenant '${TENANT_SLUG}' nao existe. Rode \`npm run db:seed\` antes.`);
  }

  const equipamentos = await gravarEquipamentos(prisma, tenant.id, itens, supabaseUrl);

  // R4: COLABORADOR, zero emprestimos.
  const professor = await garantirUsuario({ prisma, auth }, tenant.id, {
    email: EMAIL_PROFESSOR,
    senha: senhaProfessor,
    papel: 'COLABORADOR',
  });

  // R4 e Q4: conta de teste opcional, mesma logica e mesmo papel. So com as duas variaveis.
  const avisos: string[] = [];
  let teste: ResumoUsuario | null = null;
  const emailTeste = env.SEED_TESTE_EMAIL;
  const senhaTeste = env.SEED_TESTE_PASSWORD;
  if (emailTeste && senhaTeste) {
    teste = await garantirUsuario({ prisma, auth }, tenant.id, {
      email: emailTeste,
      senha: senhaTeste,
      papel: 'COLABORADOR',
    });
  } else if (emailTeste || senhaTeste) {
    avisos.push('SEED_TESTE_EMAIL e SEED_TESTE_PASSWORD: so uma das duas esta definida; conta de teste nao criada.');
  }

  return { equipamentos, professor, teste, avisos };
}
