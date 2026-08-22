-- Convite nominal (motorista pré-cadastra responsável+aluno, envia link,
-- responsável completa cadastro e assina o contrato — vínculo criado
-- automaticamente na assinatura) + assinatura eletrônica simples do
-- contrato de transporte, com prazo estruturado em meses.

-- CreateEnum
CREATE TYPE "tipo_convite" AS ENUM ('CODIGO', 'NOMINAL');

-- AlterTable
ALTER TABLE "convites"
  ADD COLUMN "tipo" "tipo_convite" NOT NULL DEFAULT 'CODIGO',
  ADD COLUMN "nome_responsavel" TEXT,
  ADD COLUMN "email_responsavel" TEXT,
  ADD COLUMN "telefone_responsavel" TEXT,
  ADD COLUMN "cpf_responsavel" TEXT,
  ADD COLUMN "dados_aluno" JSONB,
  ADD COLUMN "aluno_id_nominal" TEXT;

-- AlterTable
ALTER TABLE "contratos_transporte"
  ADD COLUMN "prazo_meses" INTEGER,
  ADD COLUMN "texto_contrato" TEXT,
  ADD COLUMN "assinado_em" TIMESTAMP(3),
  ADD COLUMN "assinado_ip" TEXT,
  ADD COLUMN "assinado_user_agent" TEXT,
  ADD COLUMN "assinado_hash" TEXT;
