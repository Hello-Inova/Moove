-- Teste grátis de 7 dias passa a ser em nível de conta (motorista e
-- responsável), automático desde o cadastro — não depende mais de escolher
-- um plano antes. Vencido o teste (e sem assinatura ATIVA), o sistema
-- bloqueia qualquer ação até o pagamento (ver AccessGate + Shells).
--
-- Contas já existentes: back-fill com criado_em + 7 dias, igual ao teste que
-- já era oferecido no fluxo antigo (não muda a experiência de quem já
-- assinou — só passa a valer pra quem ainda não tinha escolhido plano).

ALTER TABLE "motoristas" ADD COLUMN "teste_expira_em" TIMESTAMP(3);
UPDATE "motoristas" SET "teste_expira_em" = "criado_em" + INTERVAL '7 days';
ALTER TABLE "motoristas" ALTER COLUMN "teste_expira_em" SET NOT NULL;

ALTER TABLE "responsaveis" ADD COLUMN "teste_expira_em" TIMESTAMP(3);
UPDATE "responsaveis" SET "teste_expira_em" = "criado_em" + INTERVAL '7 days';
ALTER TABLE "responsaveis" ALTER COLUMN "teste_expira_em" SET NOT NULL;
