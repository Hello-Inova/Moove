import "server-only";

import { createHash } from "crypto";

/**
 * Texto do contrato gerado pro fluxo de convite nominal (assinatura
 * eletrônica simples — ver ContratoTransporte no schema). Template simples
 * em texto puro, sem validade jurídica de assinatura qualificada — decisão
 * registrada no plano de implantação (MVP: aceite dentro do app).
 */
export function gerarTextoContrato(params: {
  nomeMotorista: string;
  nomeResponsavel: string;
  cpfResponsavel: string;
  nomeAluno: string;
  escolaNome: string;
  valorMensalidade: number | null;
  diaPagamentoMensalidade: number | null;
  prazoMeses: 10 | 24 | null;
  vigenciaInicio: Date;
  vigenciaFim: Date | null;
}): string {
  const {
    nomeMotorista,
    nomeResponsavel,
    cpfResponsavel,
    nomeAluno,
    escolaNome,
    valorMensalidade,
    diaPagamentoMensalidade,
    prazoMeses,
    vigenciaInicio,
    vigenciaFim,
  } = params;

  const valorTexto =
    valorMensalidade !== null
      ? valorMensalidade.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "a combinar diretamente entre as partes";
  const vencimentoTexto = diaPagamentoMensalidade ? `todo dia ${diaPagamentoMensalidade} de cada mês` : "a combinar";
  const prazoTexto = prazoMeses ? `${prazoMeses} meses` : "por prazo indeterminado";
  const inicioTexto = vigenciaInicio.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const fimTexto = vigenciaFim ? vigenciaFim.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "sem data de término definida";

  return [
    `CONTRATO DE PRESTAÇÃO DE SERVIÇO DE TRANSPORTE ESCOLAR`,
    ``,
    `CONTRATANTE (responsável financeiro): ${nomeResponsavel}, CPF ${cpfResponsavel}.`,
    `CONTRATADO (motorista/transportador): ${nomeMotorista}.`,
    `ALUNO(A) TRANSPORTADO(A): ${nomeAluno}, matriculado(a) em ${escolaNome}.`,
    ``,
    `1. OBJETO: prestação de serviço de transporte escolar de ida e volta entre a residência informada e a escola acima.`,
    `2. PRAZO: ${prazoTexto}, com vigência de ${inicioTexto} até ${fimTexto}.`,
    `3. VALOR E PAGAMENTO: mensalidade de ${valorTexto}, com vencimento ${vencimentoTexto}, paga diretamente ao contratado (a plataforma Moove não processa nem retém esse valor).`,
    `4. RESCISÃO: qualquer das partes pode encerrar o vínculo a qualquer momento pela plataforma Moove, sem multa, respeitando o aviso prévio combinado entre as partes.`,
    `5. ACEITE ELETRÔNICO: este contrato é aceito eletronicamente pelo(a) CONTRATANTE dentro da plataforma Moove, com registro de data/hora, endereço IP e identificação do dispositivo utilizado no momento do aceite.`,
  ].join("\n");
}

export function hashTexto(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}
