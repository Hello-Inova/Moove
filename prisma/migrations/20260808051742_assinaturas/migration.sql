-- CreateEnum
CREATE TYPE "tipo_plano_assinatura" AS ENUM ('BASIC', 'PRO', 'MAX');

-- CreateEnum
CREATE TYPE "ciclo_cobranca_assinatura" AS ENUM ('MENSAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "status_assinatura" AS ENUM ('TESTE', 'ATIVA', 'EXPIRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "status_pagamento" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "tipo_plano" "tipo_plano_assinatura" NOT NULL,
    "ciclo_cobranca" "ciclo_cobranca_assinatura" NOT NULL,
    "qtd_alunos_contratados" INTEGER NOT NULL,
    "anos_adicionais" INTEGER NOT NULL DEFAULT 0,
    "valor_plano" DECIMAL(10,2) NOT NULL,
    "valor_alunos_excedentes" DECIMAL(10,2) NOT NULL,
    "valor_anos_adicionais" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "status" "status_assinatura" NOT NULL DEFAULT 'TESTE',
    "teste_expira_em" TIMESTAMP(3) NOT NULL,
    "inicio_em" TIMESTAMP(3),
    "expira_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
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

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assinaturas_motorista_id_criado_em_idx" ON "assinaturas"("motorista_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_gateway_pagamento_id_key" ON "pagamentos"("gateway_pagamento_id");

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "assinaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
