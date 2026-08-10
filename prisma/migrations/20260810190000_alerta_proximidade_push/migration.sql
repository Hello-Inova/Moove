-- Alerta sonoro de proximidade: motorista configura quantos minutos de
-- antecedência quer avisar o responsável (alerta_chegada_minutos), e o
-- responsável se inscreve para receber Web Push (push_subscriptions) — o
-- alerta dispara no servidor a cada atualização de GPS do motorista (ver
-- POST /api/motorista/localizacao) quando a distância estimada até o
-- endereço do responsável cair dentro do limite configurado.
-- alertas_proximidade evita repetir o mesmo alerta várias vezes no mesmo dia.

-- AlterTable
ALTER TABLE "motoristas" ADD COLUMN "alerta_chegada_minutos" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "responsavel_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_responsavel_id_idx" ON "push_subscriptions"("responsavel_id");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "alertas_proximidade" (
    "id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_proximidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alertas_proximidade_vinculo_id_data_key" ON "alertas_proximidade"("vinculo_id", "data");

-- AddForeignKey
ALTER TABLE "alertas_proximidade" ADD CONSTRAINT "alertas_proximidade_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "vinculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
