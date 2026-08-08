-- AlterTable
ALTER TABLE "motoristas" ADD COLUMN     "email_verificado_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "responsaveis" ADD COLUMN     "email_verificado_em" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "codigos_verificacao" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "proposito" TEXT NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),

    CONSTRAINT "codigos_verificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigos_verificacao_email_role_proposito_usado_em_idx" ON "codigos_verificacao"("email", "role", "proposito", "usado_em");
