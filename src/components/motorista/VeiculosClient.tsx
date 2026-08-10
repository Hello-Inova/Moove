"use client";

import { useCallback, useState } from "react";

import { apiGet } from "@/lib/api-client";
import { VeiculoForm } from "@/components/motorista/VeiculoForm";
import { VerDocumentoButton } from "@/components/motorista/VerDocumentoButton";
import { UploadDocumentoButton } from "@/components/motorista/UploadDocumentoButton";

export type VeiculoListagem = {
  id: string;
  placa: string;
  modelo: string;
  temDocumento: boolean;
};

/**
 * Lista + formulário de veículos, gerenciados no cliente — cadastrar um
 * veículo novo (ou enviar um documento) atualiza a lista na hora, buscando
 * só os dados (`GET /api/motorista/veiculos`), sem depender de recarregar a
 * página inteira.
 */
export function VeiculosClient({ veiculosIniciais }: { veiculosIniciais: VeiculoListagem[] }) {
  const [veiculos, setVeiculos] = useState<VeiculoListagem[]>(veiculosIniciais);

  const recarregar = useCallback(async () => {
    const result = await apiGet<VeiculoListagem[]>("/api/motorista/veiculos");
    if (result.ok) setVeiculos(result.data);
  }, []);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        {veiculos.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum veículo cadastrado ainda.</p>
        )}
        {veiculos.map((v) => (
          <div
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 dark:bg-neutral-900 dark:border-neutral-700"
          >
            <div>
              <p className="font-medium">{v.placa}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{v.modelo}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {v.temDocumento ? (
                <VerDocumentoButton veiculoId={v.id} />
              ) : (
                <span className="text-sm text-neutral-400">Sem documento</span>
              )}
              <UploadDocumentoButton veiculoId={v.id} onUploaded={recarregar} />
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
        <h2 className="mb-4 font-medium">Cadastrar novo veículo</h2>
        <VeiculoForm onSaved={recarregar} />
      </section>
    </div>
  );
}
