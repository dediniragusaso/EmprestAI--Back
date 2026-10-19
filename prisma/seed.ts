import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Idempotente: pode rodar várias vezes (docs/modelagem-banco.md §9).
async function main() {
  await prisma.tenant.upsert({
    where: { slug: 'suporte_ti' },
    update: {},
    create: { slug: 'suporte_ti', name: 'Suporte TI' },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
