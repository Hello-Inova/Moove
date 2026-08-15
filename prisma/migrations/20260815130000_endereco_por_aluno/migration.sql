-- Move o endereço de embarque/desembarque do Responsavel pro Aluno — cada
-- filho de um mesmo responsável pode ter um endereço diferente (ex.:
-- escolas diferentes), então o endereço não pode mais ser compartilhado
-- entre irmãos. A partir de agora é cadastrado/editado por aluno, no fluxo
-- "Meus alunos" do responsável, e é o que a rota otimizada do motorista usa
-- como parada.
--
-- Passos: (1) cria as colunas de endereço em "alunos"; (2) copia o endereço
-- já cadastrado em cada "responsaveis" pra TODOS os alunos daquele
-- responsável (dado real de produção — não pode ser perdido); (3) remove as
-- colunas de "responsaveis".

-- 1) Novas colunas em "alunos" (mesmos tipos/defaults que existiam em
-- "responsaveis").
ALTER TABLE "alunos"
  ADD COLUMN "cep" TEXT,
  ADD COLUMN "logradouro" TEXT,
  ADD COLUMN "numero" TEXT,
  ADD COLUMN "complemento" TEXT,
  ADD COLUMN "bairro" TEXT,
  ADD COLUMN "cidade" TEXT,
  ADD COLUMN "estado" TEXT,
  ADD COLUMN "endereco_latitude" DOUBLE PRECISION,
  ADD COLUMN "endereco_longitude" DOUBLE PRECISION,
  ADD COLUMN "endereco_atualizado_em" TIMESTAMP(3),
  ADD COLUMN "endereco_texto_encontrado" TEXT,
  ADD COLUMN "endereco_confirmado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "endereco_precisao_baixa" BOOLEAN NOT NULL DEFAULT false;

-- 2) Copia o endereço de cada responsável pra todos os seus alunos
-- (irmãos começam com o mesmo endereço, que passa a poder ser editado
-- individualmente depois — não é possível saber automaticamente qual filho
-- "dono" do endereço herdado, então todos recebem a mesma cópia inicial).
UPDATE "alunos" AS a
SET
  "cep" = r."cep",
  "logradouro" = r."logradouro",
  "numero" = r."numero",
  "complemento" = r."complemento",
  "bairro" = r."bairro",
  "cidade" = r."cidade",
  "estado" = r."estado",
  "endereco_latitude" = r."endereco_latitude",
  "endereco_longitude" = r."endereco_longitude",
  "endereco_atualizado_em" = r."endereco_atualizado_em",
  "endereco_texto_encontrado" = r."endereco_texto_encontrado",
  "endereco_confirmado" = r."endereco_confirmado",
  "endereco_precisao_baixa" = r."endereco_precisao_baixa"
FROM "responsaveis" AS r
WHERE a."responsavel_id" = r."id";

-- 3) Remove as colunas de endereço de "responsaveis" — não são mais usadas.
ALTER TABLE "responsaveis"
  DROP COLUMN "cep",
  DROP COLUMN "logradouro",
  DROP COLUMN "numero",
  DROP COLUMN "complemento",
  DROP COLUMN "bairro",
  DROP COLUMN "cidade",
  DROP COLUMN "estado",
  DROP COLUMN "endereco_latitude",
  DROP COLUMN "endereco_longitude",
  DROP COLUMN "endereco_atualizado_em",
  DROP COLUMN "endereco_texto_encontrado",
  DROP COLUMN "endereco_confirmado",
  DROP COLUMN "endereco_precisao_baixa";
