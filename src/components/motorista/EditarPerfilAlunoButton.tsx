"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { secondaryButtonClass } from "@/components/ui/form-elements";
import { EditarPerfilAlunoModal, type PerfilAlunoInicial } from "@/components/motorista/EditarPerfilAlunoModal";

export function EditarPerfilAlunoButton({
  vinculoId,
  nomeAluno,
  inicial,
}: {
  vinculoId: string;
  nomeAluno: string;
  inicial: PerfilAlunoInicial;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={secondaryButtonClass + " inline-flex w-auto items-center gap-1.5 px-3 py-1.5 text-sm"}>
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Editar perfil
      </button>
      {aberto && (
        <EditarPerfilAlunoModal vinculoId={vinculoId} nomeAluno={nomeAluno} inicial={inicial} onClose={() => setAberto(false)} />
      )}
    </>
  );
}
