-- A Asaas recusa cobrança abaixo de R$5,00 (HTTP 400 "invalid_value") e o
-- valor por aluno excedente dos planos é bem menor que isso (ex.: R$1,20).
-- Em vez de um Pagamento por CobrancaAluno, inverte a relação: várias
-- CobrancaAluno PENDENTE do mesmo motorista passam a apontar pro mesmo
-- Pagamento, agrupadas até o total bater o mínimo (ver
-- src/lib/subscription/cobranca-aluno-pagamento.ts).

-- Limpa tentativas de pagamento incompletas criadas pela versão anterior
-- (linha criada, mas a chamada à Asaas falhou antes de gravar o checkout —
-- não tem valor nenhum manter esse lixo).
DELETE FROM "pagamentos" WHERE "assinatura_id" IS NULL AND "checkout_url" IS NULL;

-- DropForeignKey
ALTER TABLE "pagamentos" DROP CONSTRAINT IF EXISTS "pagamentos_cobranca_aluno_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "pagamentos_cobranca_aluno_id_status_idx";

-- DropConstraint (checagem "exatamente um tipo" não faz mais sentido — a
-- FK de cobrança por aluno agora vive do outro lado, em cobrancas_aluno)
ALTER TABLE "pagamentos" DROP CONSTRAINT IF EXISTS "pagamentos_um_tipo_de_cobranca_check";

-- AlterTable
ALTER TABLE "pagamentos" DROP COLUMN IF EXISTS "cobranca_aluno_id";

-- AlterTable
ALTER TABLE "cobrancas_aluno" ADD COLUMN "pagamento_id" TEXT;

-- CreateIndex
CREATE INDEX "cobrancas_aluno_pagamento_id_idx" ON "cobrancas_aluno"("pagamento_id");

-- AddForeignKey
ALTER TABLE "cobrancas_aluno" ADD CONSTRAINT "cobrancas_aluno_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
