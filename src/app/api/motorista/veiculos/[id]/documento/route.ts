import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { InvalidUploadError, StorageNotConfiguredError, resolveDocumentoUrl, uploadVeiculoDocumento } from "@/lib/storage";

async function getOwnedVeiculo(motoristaId: string, veiculoId: string) {
  const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoId } });
  if (!veiculo || veiculo.motoristaId !== motoristaId) return null;
  return veiculo;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const veiculo = await getOwnedVeiculo(motorista.id, id);
  if (!veiculo) return jsonError(404, "Veículo não encontrado.");
  if (!veiculo.documentoUrl) return jsonError(404, "Nenhum documento enviado para este veículo.");

  try {
    const url = await resolveDocumentoUrl(veiculo.documentoUrl);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return jsonError(503, err.message);
    throw err;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const veiculo = await getOwnedVeiculo(motorista.id, id);
  if (!veiculo) return jsonError(404, "Veículo não encontrado.");

  const formData = await request.formData().catch(() => null);
  const documento = formData?.get("documento");
  if (!(documento instanceof File) || documento.size === 0) {
    return jsonError(400, "Envie um arquivo no campo 'documento'.");
  }

  try {
    const documentoUrl = await uploadVeiculoDocumento({
      motoristaId: motorista.id,
      veiculoId: veiculo.id,
      file: documento,
    });
    await prisma.veiculo.update({ where: { id: veiculo.id }, data: { documentoUrl } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InvalidUploadError) {
      return jsonError(400, err.message);
    }
    if (err instanceof StorageNotConfiguredError) {
      return jsonError(503, err.message);
    }
    throw err;
  }
}
