import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { veiculoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { InvalidUploadError, StorageNotConfiguredError, uploadVeiculoDocumento } from "@/lib/storage";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const veiculos = await prisma.veiculo.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
  });

  return NextResponse.json(
    veiculos.map((v) => ({
      id: v.id,
      placa: v.placa,
      modelo: v.modelo,
      temDocumento: Boolean(v.documentoUrl),
      criadoEm: v.criadoEm,
    }))
  );
}

export async function POST(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const formData = await request.formData().catch(() => null);
  if (!formData) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = veiculoSchema.safeParse({
    placa: formData.get("placa"),
    modelo: formData.get("modelo"),
  });
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { placa, modelo } = parsed.data;
  const documento = formData.get("documento");

  let veiculo;
  try {
    veiculo = await prisma.veiculo.create({
      data: { motoristaId: motorista.id, placa, modelo },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(409, "Já existe um veículo cadastrado com esta placa.");
    }
    throw err;
  }

  if (documento instanceof File && documento.size > 0) {
    try {
      const documentoUrl = await uploadVeiculoDocumento({
        motoristaId: motorista.id,
        veiculoId: veiculo.id,
        file: documento,
      });
      veiculo = await prisma.veiculo.update({
        where: { id: veiculo.id },
        data: { documentoUrl },
      });
    } catch (err) {
      if (err instanceof InvalidUploadError || err instanceof StorageNotConfiguredError) {
        return NextResponse.json(
          {
            id: veiculo.id,
            placa: veiculo.placa,
            modelo: veiculo.modelo,
            temDocumento: false,
            avisoDocumento: err.message,
          },
          { status: 201 }
        );
      }
      throw err;
    }
  }

  return NextResponse.json(
    {
      id: veiculo.id,
      placa: veiculo.placa,
      modelo: veiculo.modelo,
      temDocumento: Boolean(veiculo.documentoUrl),
    },
    { status: 201 }
  );
}
