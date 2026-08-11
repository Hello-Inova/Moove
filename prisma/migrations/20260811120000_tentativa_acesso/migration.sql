-- Rate limiting de login: registro cru de cada tentativa (motorista,
-- responsável, admin), contado numa janela curta pra bloquear força bruta.
-- Sem TTL nativo no Postgres — a limpeza roda no cron diário
-- (/api/cron/limpeza).

-- CreateTable
CREATE TABLE "tentativas_acesso" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentativas_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tentativas_acesso_chave_criado_em_idx" ON "tentativas_acesso"("chave", "criado_em");
