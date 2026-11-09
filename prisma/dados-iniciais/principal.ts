// Spec 002-dados-iniciais: orquestra os dados iniciais. Recebe as dependencias por parametro
// (cliente do Prisma, dados e variaveis de ambiente) para ser testavel sem Auth nem Supabase.
import type { PrismaClient } from '@prisma/client';
import type { ItemEquipamento } from './dados';
import { gravarEquipamentos, type ResumoEquipamentos } from './equipamentos';

export const TENANT_SLUG = 'suporte_ti';

export interface DependenciasDadosIniciais {
  prisma: PrismaClient;
  env: Record<string, string | undefined>;
  itens: ItemEquipamento[];
}

export interface ResumoDadosIniciais {
  equipamentos: ResumoEquipamentos;
}

export async function executarDadosIniciais(deps: DependenciasDadosIniciais): Promise<ResumoDadosIniciais> {
  const { prisma, env, itens } = deps;

  const supabaseUrl = env.SUPABASE_URL;
  if (!supabaseUrl) throw new Error('SUPABASE_URL ausente: a imageUrl e montada a partir dela.');

  // Q16: o script exige o tenant; quem o cria e o `db:seed`.
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    throw new Error(`Tenant '${TENANT_SLUG}' nao existe. Rode \`npm run db:seed\` antes.`);
  }

  const equipamentos = await gravarEquipamentos(prisma, tenant.id, itens, supabaseUrl);
  return { equipamentos };
}
