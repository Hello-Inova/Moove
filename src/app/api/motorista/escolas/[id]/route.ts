import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { escolaSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { geocodeCidadeAproximado, geocodeEndereco } from "@/lib/geocoding";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const escola = await prisma.escola.findUnique({ where: { id } });
  if (!escola || escola.motoristaId !== motorista.id) {
    return jsonError(404, "Escola não encontrada.");
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = escolaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, cep, logradouro, numero, complemento, bairro, cidade, estado } = parsed.data;

  // Só re-geocodifica se o endereço realmente mudou — evita bater na API de
  // geocoding à toa quando o motorista só corrigiu o nome da escola.
  const enderecoMudou =
    cep !== escola.cep ||
    logradouro !== escola.logradouro ||
    numero !== escola.numero ||
    bairro !== escola.bairro ||
    cidade !== escola.cidade ||
    estado !== escola.estado;

  const coordenadas = enderecoMudou
    ? await geocodeEndereco({ logradouro, numero, bairro, cidade, estado, cep })
    : { latitude: escola.enderecoLatitude, longitude: escola.enderecoLongitude };

  const atualizada = await prisma.escola.update({
    where: { id },
    data: {
      nome,
      cep,
      logradouro,
      numero,
      complemento: complemento || null,
      bairro,
      cidade,
      estado,
      enderecoLatitude: coordenadas?.latitude ?? null,
      enderecoLongitude: coordenadas?.longitude ?? null,
    },
  });

  const centroAproximado =
    atualizada.enderecoLatitude === null ? await geocodeCidadeAproximado(cidade, estado) : null;

  return NextResponse.json({
    id: atualizada.id,
    nome: atualizada.nome,
    geocodificada: atualizada.enderecoLatitude !== null,
    enderecoLatitude: atualizada.enderecoLatitude,
    enderecoLongitude: atualizada.enderecoLongitude,
    centroAproximado,
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const escola = await prisma.escola.findUnique({ where: { id } });
  if (!escola || escola.motoristaId !== motorista.id) {
    return jsonError(404, "Escola não encontrada.");
  }

  const emUso = await prisma.vinculo.findFirst({ where: { escolaId: id, status: "ATIVO" } });
  if (emUso) {
    return jsonError(409, "Esta escola tem alunos vinculados nela — não é possível excluir.");
  }

  await prisma.escola.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
