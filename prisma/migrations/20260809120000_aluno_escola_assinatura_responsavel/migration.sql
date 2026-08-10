-- Vínculo passa a ser por aluno (não mais por responsável/família inteira):
-- nova entidade Aluno (cadastrada pelo responsável, antes de qualquer
-- vínculo) e Escola (cadastrada pelo motorista, pode ter várias). A
-- cobrança por aluno sai do motorista e passa a ser do responsável, via um
-- catálogo de planos próprio (publico_plano) e um par de tabelas
-- assinaturas_responsavel/pagamentos_responsavel espelhando
-- assinaturas/pagamentos do motorista.

-- CreateEnum
CREATE TYPE "publico_plano" AS ENUM ('MOTORISTA', 'RESPONSAVEL');

-- CreateEnum
CREATE TYPE "status_assinatura_responsavel" AS ENUM ('PENDENTE', 'ATIVA', 'EXPIRADA', 'CANCELADA');

-- AlterTable: catálogo de planos passa a servir motorista E responsável —
-- planos existentes (Basic/Pró/Max) continuam MOTORISTA por padrão.
ALTER TABLE "planos_assinatura" ADD COLUMN "publico" "publico_plano" NOT NULL DEFAULT 'MOTORISTA';

-- Seed: os 2 planos do responsável (cobrança por aluno, sem período de
-- teste). `valor_base` aqui é interpretado como valor POR ALUNO — ver
-- src/lib/subscription/plans.ts.
INSERT INTO "planos_assinatura"
  ("id", "codigo", "label", "publico", "ciclo_cobranca", "ciclo_label", "valor_base", "alunos_gratis", "valor_por_aluno_excedente", "recursos", "permite_anos_adicionais", "destaque", "ativo", "ordem", "atualizado_em")
VALUES
  ('plano_resp_basic_seed', 'RESP_BASIC', 'Basic', 'RESPONSAVEL', 'SEMESTRAL', 'Cobrança semestral', 29.90, 0, 0,
   '["Cobrança semestral", "R$ 29,90 por aluno"]', false, NULL, true, 1, CURRENT_TIMESTAMP),
  ('plano_resp_pro_seed', 'RESP_PRO', 'Pró', 'RESPONSAVEL', 'ANUAL', 'Cobrança anual', 24.90, 0, 0,
   '["Cobrança anual", "R$ 24,90 por aluno", "Mais econômico no ano"]', false, 'Mais econômico', true, 2, CURRENT_TIMESTAMP);

-- Corrige o texto dos planos do motorista já existentes (Basic/Pró/Max):
-- eles mencionavam "alunos grátis"/"por aluno excedente", que não se aplica
-- mais — motorista agora paga só o valor fixo do plano.
UPDATE "planos_assinatura" SET "recursos" = '["Cobrança mensal", "7 dias de teste", "Valor fixo, sem depender da quantidade de alunos"]' WHERE "codigo" = 'BASIC';
UPDATE "planos_assinatura" SET "recursos" = '["Cobrança semestral", "7 dias de teste", "10% de economia vs. Basic", "Valor fixo, sem depender da quantidade de alunos"]', "destaque" = 'Mais popular' WHERE "codigo" = 'PRO';
UPDATE "planos_assinatura" SET "recursos" = '["Cobrança anual", "7 dias de teste", "Acesso ao módulo de gestão de alunos", "10% de economia vs. Basic", "Valor fixo, sem depender da quantidade de alunos"]' WHERE "codigo" = 'MAX';

-- CreateTable
CREATE TABLE "escolas" (
    "id" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "endereco_latitude" DOUBLE PRECISION,
    "endereco_longitude" DOUBLE PRECISION,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escolas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escolas_motorista_id_idx" ON "escolas"("motorista_id");

-- AddForeignKey
ALTER TABLE "escolas" ADD CONSTRAINT "escolas_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "alunos" (
    "id" TEXT NOT NULL,
    "responsavel_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alunos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alunos_responsavel_id_idx" ON "alunos"("responsavel_id");

-- AddForeignKey
ALTER TABLE "alunos" ADD CONSTRAINT "alunos_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: cada vínculo já existente (hoje por família) vira um Aluno
-- "legado" pertencente ao mesmo responsável, pra podermos tornar
-- vinculos.aluno_id obrigatório sem perder vínculos já ativos em produção.
-- O nome é só um placeholder — o responsável pode renomear depois em
-- "Meus alunos".
INSERT INTO "alunos" ("id", "responsavel_id", "nome", "criado_em")
SELECT 'aluno_legacy_' || v."id", v."responsavel_id", 'Aluno de ' || r."nome", v."criado_em"
FROM "vinculos" v
JOIN "responsaveis" r ON r."id" = v."responsavel_id";

-- AlterTable: vinculos ganha aluno_id (1:1, cada vínculo é de um aluno) e
-- escola_id (opcional — vínculos antigos ficam sem escola até o motorista
-- definir uma).
ALTER TABLE "vinculos" ADD COLUMN "aluno_id" TEXT;
ALTER TABLE "vinculos" ADD COLUMN "escola_id" TEXT;

UPDATE "vinculos" SET "aluno_id" = 'aluno_legacy_' || "id";

ALTER TABLE "vinculos" ALTER COLUMN "aluno_id" SET NOT NULL;

-- CreateIndex: NÃO única — um aluno pode ter vários vínculos ao longo do
-- tempo (histórico), só não mais de um ATIVO simultâneo (checado na
-- aplicação, ver src/app/api/responsavel/convites/usar/route.ts).
CREATE INDEX "vinculos_aluno_id_status_idx" ON "vinculos"("aluno_id", "status");

-- CreateIndex
CREATE INDEX "vinculos_escola_id_idx" ON "vinculos"("escola_id");

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_escola_id_fkey" FOREIGN KEY ("escola_id") REFERENCES "escolas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "assinaturas_responsavel" (
    "id" TEXT NOT NULL,
    "responsavel_id" TEXT NOT NULL,
    "tipo_plano" TEXT NOT NULL,
    "plano_label" TEXT NOT NULL DEFAULT '',
    "ciclo_cobranca" "ciclo_cobranca_assinatura" NOT NULL,
    "qtd_alunos_contratados" INTEGER NOT NULL,
    "valor_por_aluno" DECIMAL(10,2) NOT NULL,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "status" "status_assinatura_responsavel" NOT NULL DEFAULT 'PENDENTE',
    "inicio_em" TIMESTAMP(3),
    "expira_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinaturas_responsavel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assinaturas_responsavel_responsavel_id_criado_em_idx" ON "assinaturas_responsavel"("responsavel_id", "criado_em");

-- AddForeignKey
ALTER TABLE "assinaturas_responsavel" ADD CONSTRAINT "assinaturas_responsavel_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "pagamentos_responsavel" (
    "id" TEXT NOT NULL,
    "assinatura_id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'mercadopago',
    "gateway_pagamento_id" TEXT,
    "gateway_preference_id" TEXT,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "status_pagamento" NOT NULL DEFAULT 'PENDENTE',
    "checkout_url" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pago_em" TIMESTAMP(3),

    CONSTRAINT "pagamentos_responsavel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_responsavel_gateway_pagamento_id_key" ON "pagamentos_responsavel"("gateway_pagamento_id");

-- AddForeignKey
ALTER TABLE "pagamentos_responsavel" ADD CONSTRAINT "pagamentos_responsavel_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "assinaturas_responsavel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove o sistema legado de cobrança mensal por aluno ao motorista
-- (Plano/Cobranca/CobrancaVinculo, já documentado como "superseded" pelas
-- assinaturas pré-pagas, mas ainda presente no schema/código). Pedido
-- explícito do usuário: cobrança por aluno passa a ser só do responsável.
DROP TABLE IF EXISTS "cobranca_vinculos";
DROP TABLE IF EXISTS "cobrancas";
DROP TABLE IF EXISTS "planos";
DROP TYPE IF EXISTS "tipo_plano";
DROP TYPE IF EXISTS "status_cobranca";
