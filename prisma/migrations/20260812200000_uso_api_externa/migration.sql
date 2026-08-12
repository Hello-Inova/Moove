-- Uso das APIs pagas do Google (Geocoding, Places Autocomplete, Routes) —
-- registro cru de cada chamada, contado por mês corrente no painel admin
-- (ver src/lib/uso-api-externa.ts). Sem TTL nativo no Postgres — a limpeza
-- roda no cron diário (/api/cron/limpeza), igual a tentativas_acesso.

-- CreateTable
CREATE TABLE "uso_api_externa" (
    "id" TEXT NOT NULL,
    "api" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uso_api_externa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uso_api_externa_api_criado_em_idx" ON "uso_api_externa"("api", "criado_em");
