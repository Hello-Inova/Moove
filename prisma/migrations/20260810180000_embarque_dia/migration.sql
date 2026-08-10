-- Marcação diária de "Embarcou" / "Ausente" por aluno na rota do motorista
-- — antes só existia como estado local no navegador (sumia ao atualizar a
-- página); agora persiste, e ganha o botão "Ausente" pedido pelo usuário.

-- CreateEnum
CREATE TYPE "status_embarque_dia" AS ENUM ('EMBARCOU', 'AUSENTE');

-- CreateTable
CREATE TABLE "embarques_dia" (
    "id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "status" "status_embarque_dia" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embarques_dia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "embarques_dia_vinculo_id_data_key" ON "embarques_dia"("vinculo_id", "data");

-- AddForeignKey
ALTER TABLE "embarques_dia" ADD CONSTRAINT "embarques_dia_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "vinculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
