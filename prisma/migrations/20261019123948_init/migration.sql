-- CreateEnum
CREATE TYPE "role" AS ENUM ('COLABORADOR', 'OPERACOES');

-- CreateEnum
CREATE TYPE "equipment_category" AS ENUM ('NOTEBOOK', 'MONITOR', 'CABO', 'CAMERA', 'ACESSORIO');

-- CreateEnum
CREATE TYPE "equipment_status" AS ENUM ('DISPONIVEL', 'EMPRESTADO', 'MANUTENCAO');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "role" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "equipment_category" NOT NULL,
    "patrimonio" TEXT,
    "status" "equipment_status" NOT NULL DEFAULT 'DISPONIVEL',
    "observacao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" DATE NOT NULL,
    "returned_at" TIMESTAMPTZ(6),
    "returned_by_user_id" UUID,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_idx" ON "memberships"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_tenant_id_key" ON "memberships"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "equipment_tenant_id_status_idx" ON "equipment"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "equipment_tenant_id_created_at_idx" ON "equipment"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_tenant_id_patrimonio_key" ON "equipment"("tenant_id", "patrimonio");

-- CreateIndex
CREATE INDEX "loans_tenant_id_opened_at_idx" ON "loans"("tenant_id", "opened_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_resource_type_resource_id_idx" ON "audit_logs"("tenant_id", "resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_returned_by_user_id_fkey" FOREIGN KEY ("returned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- SQL bruto (docs/modelagem-banco.md, Apendice B)
-- ============================================================

-- 1) Espelho do Supabase Auth: FK, trigger de sincronia e carga inicial.
-- Guardado por to_regclass: o banco "sombra" do Prisma nao tem o schema auth.
DO $do$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_auth_fk
      FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

    CREATE OR REPLACE FUNCTION public.sync_user_from_auth()
    RETURNS TRIGGER AS $fn$
    BEGIN
      INSERT INTO public.users (id, email, name, updated_at)
      VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email, ''),
        now()
      )
      ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            name = EXCLUDED.name,
            updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    DROP TRIGGER IF EXISTS on_auth_user_changed ON auth.users;
    CREATE TRIGGER on_auth_user_changed
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.sync_user_from_auth();

    -- Usuarios que ja existiam antes desta migration
    INSERT INTO public.users (id, email, name)
    SELECT id, COALESCE(email, ''), COALESCE(raw_user_meta_data ->> 'name', email, '')
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$do$;

-- 2) Emprestimo aberto: paridade e unicidade por item
ALTER TABLE public.loans
  ADD CONSTRAINT loans_return_pairing
  CHECK ((returned_at IS NULL) = (returned_by_user_id IS NULL));

CREATE UNIQUE INDEX loans_one_open_per_equipment
  ON public.loans (tenant_id, equipment_id)
  WHERE returned_at IS NULL;

CREATE INDEX loans_open_user_idx
  ON public.loans (tenant_id, user_id)
  WHERE returned_at IS NULL;

CREATE INDEX loans_open_due_idx
  ON public.loans (tenant_id, due_at)
  WHERE returned_at IS NULL;

-- 3) Auditoria append-only
CREATE OR REPLACE FUNCTION public.audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs e append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_mutation ON public.audit_logs;
CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_append_only();

-- 4) Contador de rate limit (ADR-001)
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key               TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  hits              INTEGER NOT NULL DEFAULT 0
);

-- 5) RLS em todas as tabelas + policy explicita de negacao (rules/migration.md).
-- A API conecta com o role dono das tabelas e ignora o RLS (ADR-001 §7);
-- a policy bloqueia qualquer acesso direto via anon/authenticated.
-- Policies por tenant (auth.uid() + memberships) entram quando houver acesso direto.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants', 'users', 'memberships', 'equipment', 'loans',
    'audit_logs', 'rate_limit_counters'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS deny_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY deny_all ON public.%I FOR ALL USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;
