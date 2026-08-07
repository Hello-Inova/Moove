-- CreateEnum
CREATE TYPE "status_conta" AS ENUM ('ATIVA', 'SUSPENSA');

-- CreateEnum
CREATE TYPE "status_convite" AS ENUM ('PENDENTE', 'USADO', 'EXPIRADO', 'REVOGADO');

-- CreateEnum
CREATE TYPE "status_vinculo" AS ENUM ('ATIVO', 'REVOGADO');

-- CreateEnum
CREATE TYPE "tipo_plano" AS ENUM ('FREE', 'PAGO');

-- CreateEnum
CREATE TYPE "status_cobranca" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO');

-- CreateTable
CREATE TABLE "motoristas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "status_conta" "status_conta" NOT NULL DEFAULT 'ATIVA',
    "consentimento_lgpd_aceito_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veiculos" (
    "id" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "documento_url" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "veiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsaveis" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "consentimento_lgpd_aceito_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responsaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convites" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "status" "status_convite" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_por_responsavel_id" TEXT,
    "usado_em" TIMESTAMP(3),

    CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculos" (
    "id" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "responsavel_id" TEXT NOT NULL,
    "convite_id" TEXT NOT NULL,
    "status" "status_vinculo" NOT NULL DEFAULT 'ATIVO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogado_em" TIMESTAMP(3),

    CONSTRAINT "vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localizacoes" (
    "motorista_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "localizacoes_pkey" PRIMARY KEY ("motorista_id")
);

-- CreateTable
CREATE TABLE "planos" (
    "motorista_id" TEXT NOT NULL,
    "tipo" "tipo_plano" NOT NULL DEFAULT 'FREE',
    "alunos_incluidos_gratis" INTEGER NOT NULL DEFAULT 5,
    "valor_por_aluno_excedente" DECIMAL(10,2) NOT NULL DEFAULT 6.00,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("motorista_id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" TEXT NOT NULL,
    "motorista_id" TEXT NOT NULL,
    "referencia_mes" TEXT NOT NULL,
    "qtd_alunos_vinculados" INTEGER NOT NULL,
    "qtd_alunos_cobrados" INTEGER NOT NULL,
    "valor_total" DECIMAL(10,2) NOT NULL,
    "status" "status_cobranca" NOT NULL DEFAULT 'PENDENTE',
    "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pago_em" TIMESTAMP(3),

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobranca_vinculos" (
    "id" TEXT NOT NULL,
    "cobranca_id" TEXT NOT NULL,
    "vinculo_id" TEXT NOT NULL,

    CONSTRAINT "cobranca_vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "motoristas_email_key" ON "motoristas"("email");

-- CreateIndex
CREATE INDEX "veiculos_motorista_id_idx" ON "veiculos"("motorista_id");

-- CreateIndex
CREATE UNIQUE INDEX "veiculos_placa_key" ON "veiculos"("placa");

-- CreateIndex
CREATE UNIQUE INDEX "responsaveis_email_key" ON "responsaveis"("email");

-- CreateIndex
CREATE UNIQUE INDEX "convites_codigo_key" ON "convites"("codigo");

-- CreateIndex
CREATE INDEX "convites_motorista_id_idx" ON "convites"("motorista_id");

-- CreateIndex
CREATE UNIQUE INDEX "vinculos_convite_id_key" ON "vinculos"("convite_id");

-- CreateIndex
CREATE INDEX "vinculos_motorista_id_responsavel_id_status_idx" ON "vinculos"("motorista_id", "responsavel_id", "status");

-- CreateIndex
CREATE INDEX "vinculos_responsavel_id_status_idx" ON "vinculos"("responsavel_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_motorista_id_referencia_mes_key" ON "cobrancas"("motorista_id", "referencia_mes");

-- CreateIndex
CREATE UNIQUE INDEX "cobranca_vinculos_cobranca_id_vinculo_id_key" ON "cobranca_vinculos"("cobranca_id", "vinculo_id");

-- AddForeignKey
ALTER TABLE "veiculos" ADD CONSTRAINT "veiculos_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_usado_por_responsavel_id_fkey" FOREIGN KEY ("usado_por_responsavel_id") REFERENCES "responsaveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "responsaveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos" ADD CONSTRAINT "vinculos_convite_id_fkey" FOREIGN KEY ("convite_id") REFERENCES "convites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localizacoes" ADD CONSTRAINT "localizacoes_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos" ADD CONSTRAINT "planos_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_motorista_id_fkey" FOREIGN KEY ("motorista_id") REFERENCES "motoristas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobranca_vinculos" ADD CONSTRAINT "cobranca_vinculos_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "cobrancas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobranca_vinculos" ADD CONSTRAINT "cobranca_vinculos_vinculo_id_fkey" FOREIGN KEY ("vinculo_id") REFERENCES "vinculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
