-- Rota de volta (buscar os alunos nas escolas cadastradas) agora existe —
-- ver botão "Retorno" em RotaPanel.tsx. Cada vínculo passa a poder ter até
-- 2 confirmações de embarque por dia (uma da ida, uma da volta), não mais
-- só uma — daí a nova coluna `sentido` entrar na chave única.

-- CreateEnum
CREATE TYPE "sentido_viagem" AS ENUM ('IDA', 'VOLTA');

-- AlterTable: default 'IDA' pra não quebrar as linhas já existentes — toda
-- marcação feita até aqui era da única rota que existia (a ida).
ALTER TABLE "embarques_dia" ADD COLUMN "sentido" "sentido_viagem" NOT NULL DEFAULT 'IDA';

-- DropIndex
DROP INDEX "embarques_dia_vinculo_id_data_key";

-- CreateIndex
CREATE UNIQUE INDEX "embarques_dia_vinculo_id_data_sentido_key" ON "embarques_dia"("vinculo_id", "data", "sentido");
