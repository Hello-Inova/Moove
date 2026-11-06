"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import { secondaryButtonClass } from "@/components/ui/form-elements";
import { EditarPerfilAlunoModal, type PerfilAlunoInicial } from "@/components/motorista/EditarPerfilAlunoModal";

/** Abre o perfil editável sem tirar o motorista da lista de alunos. */
export function VerDetalhesAlunoButton({
  vinculoId,
  nomeAluno,
  inicial,
}: {
  vinculoId: string;
  nomeAluno: string;
  inicial?: PerfilAlunoInicial;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={secondaryButtonClass + " inline-flex w-auto items-center gap-1.5 px-3 py-1.5 text-sm"}>
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        Ver detalhes
      </button>
      {aberto && (
        <EditarPerfilAlunoModal
          vinculoId={vinculoId}
          nomeAluno={nomeAluno}
          inicial={
            inicial ?? {
              dataNascimento: null,
              genero: null,
              periodo: null,
              escolaId: null,
              valorMensalidade: null,
              diaPagamentoMensalidade: null,
              vigenciaInicio: null,
              vigenciaFim: null,
            }
          }
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}
