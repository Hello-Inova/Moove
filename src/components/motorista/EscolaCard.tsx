"use client";

import { useState } from "react";

import { EscolaForm, type EscolaEditavel } from "@/components/motorista/EscolaForm";
import { EscolaDeleteButton } from "@/components/motorista/EscolaDeleteButton";
import { secondaryButtonClass } from "@/components/ui/form-elements";

type EscolaListagem = EscolaEditavel & {
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  geocodificada: boolean;
};

/** Um item da lista de escolas — alterna entre visualização e o EscolaForm em modo edição. */
export function EscolaCard({ escola }: { escola: EscolaListagem }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 dark:bg-neutral-900 dark:border-neutral-700">
        <EscolaForm escola={escola} onSaved={() => setEditando(false)} onCancel={() => setEditando(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 dark:bg-neutral-900 dark:border-neutral-700">
      <div>
        <p className="font-medium">{escola.nome}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {[escola.logradouro, escola.numero].filter(Boolean).join(", ")} —{" "}
          {[escola.bairro, escola.cidade, escola.estado].filter(Boolean).join(", ")}
        </p>
        {!escola.geocodificada && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Endereço não localizado no mapa — rota até essa escola não vai funcionar.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditando(true)} className={secondaryButtonClass + " w-auto px-3 py-1.5 text-xs"}>
          Editar
        </button>
        <EscolaDeleteButton id={escola.id} nome={escola.nome} />
      </div>
    </div>
  );
}
