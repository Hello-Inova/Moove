-- Generaliza push_subscriptions pra também aceitar motorista (antes só
-- existia pro alerta de chegada do responsável). responsavel_id vira
-- opcional e motorista_id é adicionado — exatamente um dos dois é
-- preenchido por linha, checado na aplicação.

-- AlterTable
ALTER TABLE "push_subscriptions"
  ALTER COLUMN "responsavel_id" DROP NOT NULL,
  ADD COLUMN "motorista_id" TEXT;

-- CreateIndex
CREATE INDEX "push_subscriptions_motorista_id_idx" ON "push_subscriptions"("motorista_id");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
