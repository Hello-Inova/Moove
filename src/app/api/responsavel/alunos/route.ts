import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { alunoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { geocodeEndereco } from "@/lib/geocoding";

export async function GET() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const alunos = await prisma.aluno.findMany({
    where: { responsavelId: responsavel.id },
    orderBy: { criadoEm: "asc" },
    include: {
      vinculos: {
        where: { status: "ATIVO" },
        include: { motorista: { select: { nome: true } }, escola: { select: { nome: true } } },
        take: 1,
      },
    },
  });

  return NextResponse.json(
    alunos.map((a) => {
      const vinculoAtivo = a.vinculos[0] ?? null;
      return {
        id: a.id,
        nome: a.nome,
        vinculado: vinculoAtivo !== null,
        motoristaNome: vinculoAtivo?.motorista.nome ?? null,
        escolaNome: vinculoAtivo?.escola?.nome ?? null,
        endereco: {
          cep: a.cep,
          logradouro: a.logradouro,
          numero: a.numero,
          complemento: a.complemento,
          bairro: a.bairro,
          cidade: a.cidade,
          estado: a.estado,
          enderecoLatitude: a.enderecoLatitude,
          enderecoLongitude: a.enderecoLongitude,
          enderecoConfirmado: a.enderecoConfirmado,
        },
      };
    })
  );
}

/**
 * Cadastro do aluno é livre — o responsável não paga nada, nem pra cadastrar
 * nem pra vincular (ver /api/responsavel/convites/usar). Quem paga por
 * aluno vinculado é o motorista (ver CobrancaAluno).
 *
 * Endereço é obrigatório aqui (cada aluno tem o seu, ver comentário no
 * schema) e já é geocodificado na criação — mesmo fluxo que o cadastro do
 * responsável usava antes de o endereço migrar pra cá.
 */
export async function POST(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = alunoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, cep, logradouro, numero, complemento, bairro, cidade, estado } = parsed.data;

  const coordenadas = await geocodeEndereco({ logradouro, numero, bairro, cidade, estado, cep });

  const aluno = await prisma.aluno.create({
    data: {
      responsavelId: responsavel.id,
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
      enderecoTextoEncontrado: coordenadas?.enderecoEncontrado ?? null,
      enderecoPrecisaoBaixa: coordenadas?.precisao === "baixa",
      enderecoAtualizadoEm: new Date(),
    },
  });

  return NextResponse.json(
    {
      id: aluno.id,
      nome: aluno.nome,
      vinculado: false,
      endereco: {
        cep: aluno.cep,
        logradouro: aluno.logradouro,
        numero: aluno.numero,
        complemento: aluno.complemento,
        bairro: aluno.bairro,
        cidade: aluno.cidade,
        estado: aluno.estado,
        enderecoLatitude: aluno.enderecoLatitude,
        enderecoLongitude: aluno.enderecoLongitude,
        enderecoConfirmado: aluno.enderecoConfirmado,
      },
    },
    { status: 201 }
  );
}
