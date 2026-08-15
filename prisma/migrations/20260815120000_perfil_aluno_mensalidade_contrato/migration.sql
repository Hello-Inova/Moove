-- Módulo de gestão de alunos: perfil mais completo (nascimento, gênero,
-- período), mensalidade do transporte (dinheiro peer-to-peer entre motorista
-- e responsável, fora da plataforma) e contratos.

-- CreateEnum
CREATE TYPE "genero_aluno" AS ENUM ('MASCULINO', 'FEMININO', 'OUTRO');

-- CreateEnum
CREATE TYPE "turno_escolar" AS ENUM ('MANHA', 'TARDE', 'INTEGRAL', 'NOITE');

-- CreateEnum
CREATE TYPE "status_mensalidade_transporte" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- AlterTable
ALTER TABLE "alunos"
  ADD COLUMN "data_nascimento" TIMESTAMP(3),
  ADD COLUMN "genero" "genero_aluno";

-- AlterTable
ALTER TABLE "vinculos"
  ADD COLUMN "periodo" "turno_escolar",
  ADD COLUMN "valor_mensalidade" DECIMAL(10,2),
  ADD COLUMN "dia_pagamento_mensalidade" INTEGER,
  ADD COLUMN "vigencia_inicio" TIMESTAMP(3),
  ADD COLUMN "vigencia_fim" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "mensalidades_transporte" (
    "id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "mes_referencia" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "status_mensalidade_transporte" NOT NULL DEFAULT 'PENDENTE',
    "pago_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensalidades_transporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mensalidades_transporte_vinculo_id_mes_referencia_key" ON "mensalidades_transporte"("vinculo_id", "mes_referencia");

-- CreateIndex
CREATE INDEX "mensalidades_transporte_motorista_id_status_idx" ON "mensalidades_transporte"("motorista_id", "status");

-- AddForeignKey
ALTER TABLE "mensalidades_transporte" ADD CONSTRAINT "mensalidades_transporte_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "vinculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensalidades_transporte" ADD CONSTRAINT "mensalidades_transporte_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "contratos_transporte" (
    "id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "observacoes" TEXT,
    "arquivo_url" TEXT,
    "vigencia_inicio" TIMESTAMP(3),
    "vigencia_fim" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contratos_transporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contratos_transporte_vinculo_id_idx" ON "contratos_transporte"("vinculo_id");

-- AddForeignKey
ALTER TABLE "contratos_transporte" ADD CONSTRAINT "contratos_transporte_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "vinculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
