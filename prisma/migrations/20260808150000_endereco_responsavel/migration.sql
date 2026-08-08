-- Endereço de embarque/desembarque no Responsável (usado como parada na
-- rota otimizada do motorista). Todos os campos ficam nulos por padrão —
-- contas já existentes continuam funcionando normalmente, só não entram no
-- cálculo de rota até o responsável preencher o endereço em "Meu endereço".

ALTER TABLE "responsaveis"
  ADD COLUMN "cep" TEXT,
  ADD COLUMN "logradouro" TEXT,
  ADD COLUMN "numero" TEXT,
  ADD COLUMN "complemento" TEXT,
  ADD COLUMN "bairro" TEXT,
  ADD COLUMN "cidade" TEXT,
  ADD COLUMN "estado" TEXT,
  ADD COLUMN "endereco_latitude" DOUBLE PRECISION,
  ADD COLUMN "endereco_longitude" DOUBLE PRECISION,
  ADD COLUMN "endereco_atualizado_em" TIMESTAMP(3);
