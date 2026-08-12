-- Mudança de modelo de negócio: quem paga por aluno vinculado agora é o
-- MOTORISTA (além do plano fixo da plataforma), não mais o responsável.
-- Remove as tabelas antigas de assinatura do responsável — sem assinantes
-- reais até este ponto (confirmado antes de aplicar esta migration, não
-- precisa de plano de migração de dados) — e adiciona os campos/tabela do
-- novo modelo: cobrança por aluno a cada 30 dias de vínculo ATIVO, com PIX
-- da chave do próprio motorista (fora da plataforma, controle manual).

-- DropForeignKey
ALTER TABLE "pagamentos_responsavel" DROP CONSTRAINT "pagamentos_responsavel_assinatura_id_fkey";

-- DropForeignKey
ALTER TABLE "assinaturas_responsavel" DROP CONSTRAINT "assinaturas_responsavel_responsavel_id_fkey";

-- DropTable
DROP TABLE "pagamentos_responsavel";

-- DropTable
DROP TABLE "assinaturas_responsavel";

-- DropEnum
DROP TYPE "status_assinatura_responsavel";

-- AlterTable
ALTER TABLE "motoristas"
  ADD COLUMN "chave_pix" TEXT;

-- AlterTable
ALTER TABLE "assinaturas"
  ADD COLUMN "alunos_gratis" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "valor_por_aluno_excedente" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "vinculos"
  ADD COLUMN "proxima_cobranca_em" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "status_cobranca_aluno" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateTable
CREATE TABLE "cobrancas_aluno" (
    "id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "ciclo_inicio" TIMESTAMP(3) NOT NULL,
    "ciclo_fim" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "status_cobranca_aluno" NOT NULL DEFAULT 'PENDENTE',
    "pago_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobrancas_aluno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cobrancas_aluno_motorista_id_status_idx" ON "cobrancas_aluno"("motorista_id", "status");

-- CreateIndex
CREATE INDEX "cobrancas_aluno_vinculo_id_ciclo_inicio_idx" ON "cobrancas_aluno"("vinculo_id", "ciclo_inicio");

-- AddForeignKey
ALTER TABLE "cobrancas_aluno" ADD CONSTRAINT "cobrancas_aluno_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "vinculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas_aluno" ADD CONSTRAINT "cobrancas_aluno_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
