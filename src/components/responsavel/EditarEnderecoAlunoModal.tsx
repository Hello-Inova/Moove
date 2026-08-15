"use client";

import { useEffect } from "react";

import { EnderecoAlunoForm } from "@/components/responsavel/EnderecoAlunoForm";
import type { EnderecoValores } from "@/components/ui/EnderecoFields";

export function EditarEnderecoAlunoModal({
  alunoId,
  nomeAluno,
  defaultValues,
  geocodificado,
  enderecoLatitude,
  enderecoLongitude,
  enderecoTextoEncontrado,
  enderecoConfirmado,
  enderecoPrecisaoBaixa,
  onClose,
}: {
  alunoId: string;
  nomeAluno: string;
  defaultValues: Partial<EnderecoValores>;
  geocodificado: boolean;
  enderecoLatitude?: number | null;
  enderecoLongitude?: number | null;
  enderecoTextoEncontrado?: string | null;
  enderecoConfirmado?: boolean;
  enderecoPrecisaoBaixa?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Endereço de {nomeAluno}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        <EnderecoAlunoForm
          alunoId={alunoId}
          defaultValues={defaultValues}
          geocodificado={geocodificado}
          enderecoLatitude={enderecoLatitude}
          enderecoLongitude={enderecoLongitude}
          enderecoTextoEncontrado={enderecoTextoEncontrado}
          enderecoConfirmado={enderecoConfirmado}
          enderecoPrecisaoBaixa={enderecoPrecisaoBaixa}
        />
      </div>
    </div>
  );
}
