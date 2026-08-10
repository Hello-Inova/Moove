-- CPF de motorista e responsável — impede que a mesma pessoa se cadastre
-- mais de uma vez. Nullable: contas já existentes ficam sem CPF (sem
-- backfill possível), mas cadastros novos passam a exigir o campo na
-- aplicação (ver motoristaRegisterSchema/responsavelRegisterSchema). Índice
-- único em coluna nullable no Postgres permite múltiplos NULLs sem conflito
-- — só bloqueia duas linhas com o MESMO cpf preenchido.

-- AlterTable
ALTER TABLE "motoristas" ADD COLUMN "cpf" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "motoristas_cpf_key" ON "motoristas"("cpf");

-- AlterTable
ALTER TABLE "responsaveis" ADD COLUMN "cpf" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "responsaveis_cpf_key" ON "responsaveis"("cpf");
