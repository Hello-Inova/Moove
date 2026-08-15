import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { editarEnderecoAlunoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { geocodeCidadeAproximado, geocodeEndereco } from "@/lib/geocoding";

async function buscarAlunoDoResponsavel(alunoId: string, responsavelId: string) {
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.responsavelId !== responsavelId) return null;
  return aluno;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const aluno = await buscarAlunoDoResponsavel(id, responsavel.id);
  if (!aluno) return jsonError(404, "Aluno não encontrado.");

  return NextResponse.json({
    cep: aluno.cep,
    logradouro: aluno.logradouro,
    numero: aluno.numero,
    complemento: aluno.complemento,
    bairro: aluno.bairro,
    cidade: aluno.cidade,
    estado: aluno.estado,
    enderecoLatitude: aluno.enderecoLatitude,
    enderecoLongitude: aluno.enderecoLongitude,
    enderecoTextoEncontrado: aluno.enderecoTextoEncontrado,
    enderecoConfirmado: aluno.enderecoConfirmado,
    enderecoPrecisaoBaixa: aluno.enderecoPrecisaoBaixa,
  });
}

/**
 * Cria/atualiza o endereço DESTE aluno e regeocodifica — é esse endereço
 * que a rota otimizada do motorista usa como parada pra ele (ver
 * `src/lib/routing/osrm.ts` e `GET /api/motorista/rota`). Equivalente ao
 * antigo `PATCH /api/responsavel/endereco`, só que por aluno em vez de por
 * responsável (irmãos podem ter endereços diferentes).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const aluno = await buscarAlunoDoResponsavel(id, responsavel.id);
  if (!aluno) return jsonError(404, "Aluno não encontrado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = editarEnderecoAlunoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { cep, logradouro, numero, complemento, bairro, cidade, estado } = parsed.data;

  const coordenadas = await geocodeEndereco({ logradouro, numero, bairro, cidade, estado, cep });

  const atualizado = await prisma.aluno.update({
    where: { id: aluno.id },
    data: {
      cep,
      logradouro,
      numero,
      complemento: complemento || null,
      bairro,
      cidade,
      estado,
      enderecoLatitude: coordenadas?.latitude ?? null,
      enderecoLongitude: coordenadas?.longitude ?? null,
      enderecoTextoEncontrado: coordenadas?.enderecoEncontrado ?? null,
      // Todo endereço recém-(re)geocodificado começa como NÃO confirmado —
      // mesmo que a coordenada esteja certa, ninguém olhou o pino ainda.
      enderecoConfirmado: false,
      enderecoPrecisaoBaixa: coordenadas?.precisao === "baixa",
      enderecoAtualizadoEm: new Date(),
    },
  });

  // Se a geocodificação falhou de vez, busca um centro aproximado (só
  // cidade/UF) pra pelo menos centralizar o mapa de ajuste manual — sem
  // isso a pessoa fica sem mapa nenhum pra posicionar o pino.
  const centroAproximado = coordenadas === null ? await geocodeCidadeAproximado(cidade, estado) : null;

  return NextResponse.json({
    ok: true,
    geocodificado: coordenadas !== null,
    enderecoLatitude: atualizado.enderecoLatitude,
    enderecoLongitude: atualizado.enderecoLongitude,
    enderecoTextoEncontrado: atualizado.enderecoTextoEncontrado,
    enderecoPrecisaoBaixa: atualizado.enderecoPrecisaoBaixa,
    centroAproximado,
  });
}
