-- Spec 002-dados-iniciais (R2): foto do equipamento e credito do autor.
-- SQL gerado por `prisma migrate diff` entre o schema anterior e o atual: `migrate dev
-- --create-only` falha neste banco com P4002 (FK de public.users para o schema auth do Supabase).
-- Sem tabela nova, logo sem policy nova: o RLS deny_all da `init` continua valendo para `equipment`.
-- Linhas existentes ficam com as colunas nulas; nao ha passo de preenchimento.

-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "image_author" TEXT,
ADD COLUMN     "image_license" TEXT,
ADD COLUMN     "image_page_url" TEXT,
ADD COLUMN     "image_pixabay_id" INTEGER,
ADD COLUMN     "image_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "equipment_tenant_id_image_pixabay_id_key" ON "equipment"("tenant_id", "image_pixabay_id");
