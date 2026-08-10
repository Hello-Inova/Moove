"use client";

import { useCallback, useState } from "react";

import { apiGet } from "@/lib/api-client";
import { EscolaForm } from "@/components/motorista/EscolaForm";
import { EscolaCard } from "@/components/motorista/EscolaCard";

export type EscolaListagem = {
  id: string;
  nome: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  geocodificada: boolean;
};

/**
 * Lista + formulário de escolas, gerenciados no cliente — cadastrar, editar
 * ou excluir uma escola atualiza a lista na hora (busca só os dados em
 * `GET /api/motorista/escolas`), sem recarregar a página.
 */
export function EscolasClient({ escolasIniciais }: { escolasIniciais: EscolaListagem[] }) {
  const [escolas, setEscolas] = useState<EscolaListagem[]>(escolasIniciais);

  const recarregar = useCallback(async () => {
    const result = await apiGet<EscolaListagem[]>("/api/motorista/escolas");
    if (result.ok) setEscolas(result.data);
  }, []);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        {escolas.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma escola cadastrada ainda.</p>
        )}
        {escolas.map((e) => (
          <EscolaCard
            key={e.id}
            escola={{
              id: e.id,
              nome: e.nome,
              cep: e.cep ?? "",
              logradouro: e.logradouro ?? "",
              numero: e.numero ?? "",
              complemento: e.complemento ?? "",
              bairro: e.bairro ?? "",
              cidade: e.cidade ?? "",
              estado: e.estado ?? "",
              geocodificada: e.geocodificada,
            }}
            onChanged={recarregar}
          />
        ))}
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
        <h2 className="mb-4 font-medium">Cadastrar nova escola</h2>
        <EscolaForm onSaved={recarregar} />
      </section>
    </div>
  );
}
