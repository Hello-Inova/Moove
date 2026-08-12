/**
 * Telefone é texto livre em Responsavel/Motorista (sem validação de
 * formato — ver schemas.ts) então precisa ser normalizado antes de virar
 * link wa.me: só dígitos, com o 55 (Brasil) na frente quando faltar.
 */
export function normalizarTelefoneWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length === 0) return "";
  if (digitos.startsWith("55") && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}

/** Monta o link wa.me com o telefone normalizado e a mensagem já preenchida. */
export function linkWhatsApp(telefone: string, mensagem: string): string | null {
  const numero = normalizarTelefoneWhatsApp(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
