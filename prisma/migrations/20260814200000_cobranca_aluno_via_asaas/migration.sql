-- Cobrança por aluno excedente passa a ser paga pelo motorista direto pela
-- Asaas (mesmo gateway já usado pra mensalidade da plataforma), em vez do
-- fluxo manual antigo (motorista cobrava o responsável via WhatsApp/PIX e
-- marcava como paga manualmente). Reaproveita a tabela `pagamentos` em vez
-- de criar uma tabela nova de gateway — por isso `assinatura_id` vira
-- opcional e ganha `cobranca_aluno_id` como alternativa.

-- DropForeignKey
ALTER TABLE "pagamentos" DROP CONSTRAINT "pagamentos_assinatura_id_fkey";

-- AlterTable
ALTER TABLE "pagamentos"
  ALTER COLUMN "assinatura_id" DROP NOT NULL,
  ADD COLUMN "cobranca_aluno_id" TEXT;

-- CreateIndex
CREATE INDEX "pagamentos_cobranca_aluno_id_status_idx" ON "pagamentos"("cobranca_aluno_id", "status");

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "assinaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_cobranca_aluno_id_fkey" FOREIGN KEY ("cobranca_aluno_id") REFERENCES "cobrancas_aluno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Garante que todo pagamento pertence a exatamente um dos dois tipos de
-- cobrança (nunca os dois, nunca nenhum) — reforça na base o que a aplicação
-- já garante ao criar o registro.
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_um_tipo_de_cobranca_check"
  CHECK (
    ("assinatura_id" IS NOT NULL AND "cobranca_aluno_id" IS NULL)
    OR
    ("assinatura_id" IS NULL AND "cobranca_aluno_id" IS NOT NULL)
  );
