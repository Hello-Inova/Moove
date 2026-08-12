import { linkWhatsApp } from "@/lib/whatsapp";

/**
 * Botão wa.me — abre o WhatsApp do responsável com a mensagem de cobrança já
 * preenchida (incluindo a chave PIX do motorista). Não envia nada sozinho:
 * o motorista revisa e clica em enviar dentro do próprio WhatsApp. Sem custo,
 * sem API paga (ver decisão registrada — WhatsApp Business API ficaria fora
 * do escopo gratuito).
 */
export function WhatsAppCobrancaButton({
  telefoneResponsavel,
  nomeResponsavel,
  nomeAluno,
  valor,
  chavePix,
}: {
  telefoneResponsavel: string;
  nomeResponsavel: string;
  nomeAluno: string;
  valor: number;
  chavePix: string | null;
}) {
  const valorFormatado = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const mensagem = chavePix
    ? `Olá, ${nomeResponsavel}! Aqui é o motorista escolar de ${nomeAluno}. Segue a cobrança do transporte referente ao mês: ${valorFormatado}.\n\nChave PIX: ${chavePix}\n\nQualquer dúvida, me chama por aqui. Obrigado!`
    : `Olá, ${nomeResponsavel}! Aqui é o motorista escolar de ${nomeAluno}. Segue a cobrança do transporte referente ao mês: ${valorFormatado}.\n\nQualquer dúvida, me chama por aqui. Obrigado!`;

  const href = linkWhatsApp(telefoneResponsavel, mensagem);

  if (!href) {
    return <span className="text-xs text-neutral-400">Telefone do responsável inválido</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/70"
    >
      Cobrar no WhatsApp
    </a>
  );
}
