-- Histórico de percursos do motorista — pontos de GPS coletados durante o
-- compartilhamento e um snapshot dos status de embarque do dia, fechados
-- pelo botão "Encerrar rota". Base do relatório diário do motorista.

-- CreateTable
CREATE TABLE "percursos_dia" (
    "id" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "iniciado_em" TIMESTAMP(3) NOT NULL,
    "encerrado_em" TIMESTAMP(3),
    "total_alunos" INTEGER NOT NULL DEFAULT 0,
    "total_embarcaram" INTEGER NOT NULL DEFAULT 0,
    "total_ausentes" INTEGER NOT NULL DEFAULT 0,
    "distancia_metros" DOUBLE PRECISION,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "percursos_dia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "percursos_dia_motorista_id_data_idx" ON "percursos_dia"("motorista_id", "data");

-- AddForeignKey
ALTER TABLE "percursos_dia" ADD CONSTRAINT "percursos_dia_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "percurso_pontos" (
    "id" TEXT NOT NULL,
    "percurso_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "percurso_pontos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "percurso_pontos_percurso_id_criado_em_idx" ON "percurso_pontos"("percurso_id", "criado_em");

-- AddForeignKey
ALTER TABLE "percurso_pontos" ADD CONSTRAINT "percurso_pontos_percurso_id_fkey" FOREIGN KEY ("percurso_id") REFERENCES "percursos_dia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
