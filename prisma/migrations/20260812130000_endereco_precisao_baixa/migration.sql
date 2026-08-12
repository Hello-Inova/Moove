-- Sinaliza quando a coordenada geocodificada veio de uma etapa de baixa
-- confiança (texto livre ou centro do CEP via BrasilAPI) — descoberto na
-- prática que o campo de coordenada da BrasilAPI pode vir com o texto do
-- endereço correto mas a coordenada em outra rua/região do CEP. A UI usa
-- esse sinal pra insistir mais na confirmação manual nesses casos.

ALTER TABLE "responsaveis"
  ADD COLUMN "endereco_precisao_baixa" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "escolas"
  ADD COLUMN "endereco_precisao_baixa" BOOLEAN NOT NULL DEFAULT false;
