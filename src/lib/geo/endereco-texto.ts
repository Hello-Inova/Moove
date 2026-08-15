// Formatação de endereço em texto — extraído de `src/lib/geocoding.ts` pra
// um módulo sem `server-only`/Prisma, só pra poder ser testado em unidade
// sem precisar do Prisma Client gerado nem de ambiente de servidor. A
// função continua re-exportada em `geocoding.ts` pra não quebrar quem já
// importa de lá.

/** Monta a string de endereço padrão usada para exibir na UI (lista de
 * paradas do motorista, tela de perfil) — não é usada para geocodificar
 * (ver `geocodeEndereco` em geocoding.ts, que usa busca estruturada). */
export function montarEnderecoTexto(endereco: {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}): string {
  const linha1 = [endereco.logradouro, endereco.numero].filter(Boolean).join(", ");
  const linha2 = [endereco.bairro, endereco.cidade, endereco.estado].filter(Boolean).join(", ");
  return [linha1, linha2].filter(Boolean).join(" — ");
}
