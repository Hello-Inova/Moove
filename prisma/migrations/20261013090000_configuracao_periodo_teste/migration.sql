CREATE TABLE "configuracoes_sistema" (
    "id" TEXT NOT NULL,
    "periodo_teste_dias" INTEGER NOT NULL DEFAULT 7,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configuracoes_sistema_pkey" PRIMARY KEY ("id")
);

INSERT INTO "configuracoes_sistema" ("id", "periodo_teste_dias", "atualizado_em")
VALUES ('global', 7, CURRENT_TIMESTAMP);
