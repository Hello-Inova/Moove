-- CreateEnum
CREATE TYPE "status_chamado_suporte" AS ENUM ('ABERTO', 'RECEBIDO', 'ENCERRADO');

-- CreateTable
CREATE TABLE "chamados_suporte" (
  "id" TEXT NOT NULL,
  "numero" SERIAL NOT NULL,
  "motorista_id" TEXT,
  "responsavel_id" TEXT,
  "nome" TEXT NOT NULL,
  "whatsapp" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "status" "status_chamado_suporte" NOT NULL DEFAULT 'ABERTO',
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chamados_suporte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chamados_suporte_numero_key" ON "chamados_suporte"("numero");
CREATE INDEX "chamados_suporte_motorista_id_criado_em_idx" ON "chamados_suporte"("motorista_id", "criado_em");
CREATE INDEX "chamados_suporte_responsavel_id_criado_em_idx" ON "chamados_suporte"("responsavel_id", "criado_em");
CREATE INDEX "chamados_suporte_status_criado_em_idx" ON "chamados_suporte"("status", "criado_em");

ALTER TABLE "chamados_suporte" ADD CONSTRAINT "chamados_suporte_motorista_id_fkey"
  FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_suporte" ADD CONSTRAINT "chamados_suporte_responsavel_id_fkey"
  FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
