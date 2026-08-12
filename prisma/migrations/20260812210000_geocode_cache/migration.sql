-- Cache de geocodificação por endereço (chave normalizada) — evita chamar
-- LocationIQ/Nominatim/Google de novo pro mesmo endereço já resolvido antes
-- (ver src/lib/geocoding.ts). TTL de 180 dias aplicado na aplicação, não
-- aqui; a limpeza de linhas velhas roda no cron diário (/api/cron/limpeza).

-- CreateTable
CREATE TABLE "geocode_cache" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "endereco_encontrado" TEXT,
    "precisao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "geocode_cache_chave_key" ON "geocode_cache"("chave");
