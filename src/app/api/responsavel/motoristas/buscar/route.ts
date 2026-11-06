import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

/** Pesquisa motoristas ativos pelas escolas e endereços que eles cadastraram. */
export async function GET(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const escola = request.nextUrl.searchParams.get("escola")?.trim() ?? "";
  const endereco = request.nextUrl.searchParams.get("endereco")?.trim() ?? "";
  if (escola.length < 2 || endereco.length < 3) {
    return jsonError(400, "Informe o nome da escola e pelo menos parte do endereço.");
  }

  const escolas = await prisma.escola.findMany({
    where: {
      nome: { contains: escola, mode: "insensitive" },
      motorista: { statusConta: "ATIVA" },
      OR: [
        { enderecoTextoEncontrado: { contains: endereco, mode: "insensitive" } },
        { logradouro: { contains: endereco, mode: "insensitive" } },
        { bairro: { contains: endereco, mode: "insensitive" } },
        { cidade: { contains: endereco, mode: "insensitive" } },
        { cep: { contains: endereco.replace(/\D/g, ""), mode: "insensitive" } },
      ],
    },
    select: {
      nome: true,
      logradouro: true,
      numero: true,
      bairro: true,
      cidade: true,
      estado: true,
      motorista: { select: { id: true, nome: true, veiculos: { select: { modelo: true } } } },
    },
    take: 30,
  });

  const porMotorista = new Map<string, { id: string; nome: string; escolas: { nome: string; endereco: string }[]; veiculos: string[] }>();
  for (const item of escolas) {
    const enderecoEscola = [
      item.logradouro && `${item.logradouro}${item.numero ? `, ${item.numero}` : ""}`,
      item.bairro,
      item.cidade && item.estado && `${item.cidade} - ${item.estado}`,
    ].filter(Boolean).join(" · ");
    const existente = porMotorista.get(item.motorista.id) ?? {
      id: item.motorista.id,
      nome: item.motorista.nome,
      escolas: [],
      veiculos: item.motorista.veiculos.map((v) => v.modelo),
    };
    existente.escolas.push({ nome: item.nome, endereco: enderecoEscola || "Endereço cadastrado" });
    porMotorista.set(item.motorista.id, existente);
  }

  return NextResponse.json(Array.from(porMotorista.values()));
}
