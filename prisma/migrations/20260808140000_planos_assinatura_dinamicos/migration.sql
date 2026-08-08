-- Planos de assinatura passam a ser um catálogo editável (tabela
-- planos_assinatura), gerenciado pelo painel admin, em vez de um enum fixo
-- (BASIC/PRO/MAX) com valores fixos no código.

-- CreateTable
CREATE TABLE "planos_assinatura" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ciclo_cobranca" "ciclo_cobranca_assinatura" NOT NULL,
    "ciclo_label" TEXT NOT NULL,
    "valor_base" DECIMAL(10,2) NOT NULL,
    "alunos_gratis" INTEGER NOT NULL DEFAULT 0,
    "valor_por_aluno_excedente" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "recursos" JSONB NOT NULL DEFAULT '[]',
    "permite_anos_adicionais" BOOLEAN NOT NULL DEFAULT false,
    "destaque" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planos_assinatura_codigo_key" ON "planos_assinatura"("codigo");

-- Seed: os três planos que hoje existem fixos no código, para que assinaturas
-- já existentes (tipo_plano = 'BASIC'/'PRO'/'MAX') continuem resolvendo para
-- um plano válido no novo catálogo.
INSERT INTO "planos_assinatura"
  ("id", "codigo", "label", "ciclo_cobranca", "ciclo_label", "valor_base", "alunos_gratis", "valor_por_aluno_excedente", "recursos", "permite_anos_adicionais", "destaque", "ativo", "ordem", "atualizado_em")
VALUES
  ('plano_basic_seed', 'BASIC', 'Basic', 'MENSAL', 'Cobrança mensal', 33.00, 0, 1.00,
   '["Cobrança mensal", "7 dias de teste", "+ R$ 1,00 por aluno"]', false, NULL, true, 1, CURRENT_TIMESTAMP),
  ('plano_pro_seed', 'PRO', 'Pró', 'SEMESTRAL', 'Cobrança semestral', 178.20, 5, 1.00,
   '["Cobrança semestral", "7 dias de teste", "10% de economia vs. Basic", "5 alunos grátis", "+ R$ 1,00 por aluno excedente"]', false, 'Mais popular', true, 2, CURRENT_TIMESTAMP),
  ('plano_max_seed', 'MAX', 'Max', 'ANUAL', 'Cobrança anual', 356.40, 10, 1.00,
   '["Cobrança anual", "7 dias de teste", "Acesso ao módulo de gestão de alunos", "10 alunos grátis", "10% de economia vs. Basic", "+ R$ 1,00 por aluno excedente"]', true, NULL, true, 3, CURRENT_TIMESTAMP);

-- AlterTable: tipo_plano deixa de ser o enum tipo_plano_assinatura e passa a
-- ser texto livre (código do plano no novo catálogo). O valor já gravado
-- (BASIC/PRO/MAX) é preservado no cast enum -> text.
ALTER TABLE "assinaturas" ALTER COLUMN "tipo_plano" TYPE TEXT USING "tipo_plano"::TEXT;

-- AlterTable: snapshot do rótulo do plano no momento da contratação (histórico
-- não quebra se o plano for renomeado/excluído depois). Backfill a partir do
-- catálogo recém-criado para assinaturas já existentes.
ALTER TABLE "assinaturas" ADD COLUMN "plano_label" TEXT NOT NULL DEFAULT '';
UPDATE "assinaturas" a SET "plano_label" = p."label" FROM "planos_assinatura" p WHERE p."codigo" = a."tipo_plano";

-- CreateIndex
CREATE INDEX "assinaturas_tipo_plano_idx" ON "assinaturas"("tipo_plano");

-- DropEnum (não é mais referenciado por nenhuma coluna)
DROP TYPE "tipo_plano_assinatura";
