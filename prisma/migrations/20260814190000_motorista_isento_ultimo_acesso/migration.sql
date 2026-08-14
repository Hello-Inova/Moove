-- Isenção de cobrança (admin marca motoristas que nunca devem ser
-- bloqueados por assinatura vencida — cortesia/parceria) e último acesso
-- (login), usados na listagem do admin (/admin/motoristas).

-- AlterTable
ALTER TABLE "motoristas"
  ADD COLUMN "isento_cobranca" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ultimo_acesso_em" TIMESTAMP(3);
