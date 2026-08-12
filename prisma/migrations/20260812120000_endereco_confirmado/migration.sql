-- Rastreia se o endereço/escola foi CONFIRMADO manualmente por uma pessoa no
-- mapa (PinPicker), além de guardar o texto que o provedor de geocodificação
-- resolveu (pra mostrar na UI ao lado do pino). Um endereço "geocodificado
-- com sucesso" não é o mesmo que "conferido por humano" — essa lacuna é a
-- causa raiz de pinos em lugar errado passarem despercebidos.
--
-- Default false: contas já existentes ficam marcadas como "não confirmadas"
-- até a pessoa abrir a tela de endereço/escola e confirmar o pino uma vez —
-- comportamento intencional, não uma regressão.

ALTER TABLE "responsaveis"
  ADD COLUMN "endereco_texto_encontrado" TEXT,
  ADD COLUMN "endereco_confirmado" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "escolas"
  ADD COLUMN "endereco_texto_encontrado" TEXT,
  ADD COLUMN "endereco_confirmado" BOOLEAN NOT NULL DEFAULT false;
