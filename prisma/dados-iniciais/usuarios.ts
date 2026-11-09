// Spec 002-dados-iniciais, R4 e R5: usuario no Auth (so se nao existir), espelho e membership.
// Nunca escreve em `loans`: o usuario nasce com zero emprestimos (CA-07).
import type { PrismaClient, Role } from '@prisma/client';
import type { ClienteAuthAdmin } from './auth';

export interface DadosUsuario {
  email: string;
  senha: string;
  papel: Role;
}

export interface ResumoUsuario {
  criado: boolean;
  userId: string;
}

export async function garantirUsuario(
  deps: { prisma: PrismaClient; auth: ClienteAuthAdmin },
  tenantId: string,
  dados: DadosUsuario,
): Promise<ResumoUsuario> {
  const { prisma, auth } = deps;

  // Se ja existe, nao se altera a senha (Q12).
  const existente = await auth.buscarPorEmail(dados.email);
  const usuario = existente ?? (await auth.criar({ email: dados.email, senha: dados.senha }));

  // O trigger on_auth_user_changed cria a linha em public.users; sem ela a membership nao tem FK.
  const espelho = await prisma.user.findUnique({ where: { id: usuario.id } });
  if (!espelho) {
    throw new Error(
      `Usuario ${dados.email} existe no Auth mas nao apareceu em public.users ` +
        '(trigger on_auth_user_changed ausente?). Nada de membership foi criado.',
    );
  }

  // `update` vazio: se a membership ja existe, o papel nao e reescrito.
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: usuario.id, tenantId } },
    create: { userId: usuario.id, tenantId, role: dados.papel },
    update: {},
  });

  return { criado: !existente, userId: usuario.id };
}
