"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { apiPostJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { EnderecoFields } from "@/components/ui/EnderecoFields";

export type AlunoCriado = {
  id: string;
  nome: string;
  vinculado: boolean;
  motoristaNome: string | null;
  escolaNome: string | null;
  endereco: {
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    enderecoLatitude: number | null;
    enderecoLongitude: number | null;
    enderecoConfirmado: boolean;
  };
};

/**
 * Modal de cadastro de um novo aluno — junta no mesmo lugar os dados que o
 * motorista também enxerga na tela de perfil do aluno (nome, nascimento,
 * gênero — ver EditarPerfilAlunoModal.tsx) mais o endereço de embarque/
 * desembarque (obrigatório aqui, é o que a rota do motorista usa pra
 * traçar a parada). Período, escola e valor da mensalidade ficam de fora
 * de propósito: são específicos do vínculo com um motorista, que ainda não
 * existe nesse momento — o motorista completa isso depois, já com o aluno
 * vinculado (mesmo EditarPerfilAlunoModal.tsx).
 */
export function NovoAlunoModal({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (aluno: AlunoCriado) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const payload = {
      nome: form.get("nome"),
      dataNascimento: form.get("dataNascimento") || null,
      genero: form.get("genero") || null,
      cep: form.get("cep"),
      logradouro: form.get("logradouro"),
      numero: form.get("numero"),
      complemento: form.get("complemento"),
      bairro: form.get("bairro"),
      cidade: form.get("cidade"),
      estado: form.get("estado"),
    };
    const result = await apiPostJson<AlunoCriado>("/api/responsavel/alunos", payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    toast.success("Aluno adicionado.");
    onCriado(result.data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Novo aluno</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="nome">
              Nome do aluno
            </label>
            <input id="nome" name="nome" required className={inputClass} />
            <FieldError message={issues.nome?.[0]} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="dataNascimento">
                Data de nascimento <span className="font-normal text-neutral-400">(opcional)</span>
              </label>
              <input id="dataNascimento" name="dataNascimento" type="date" className={inputClass} />
              <FieldError message={issues.dataNascimento?.[0]} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="genero">
                Gênero <span className="font-normal text-neutral-400">(opcional)</span>
              </label>
              <select id="genero" name="genero" defaultValue="" className={inputClass}>
                <option value="">Prefiro não informar</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMININO">Feminino</option>
                <option value="OUTRO">Outro</option>
              </select>
              <FieldError message={issues.genero?.[0]} />
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <p className="mb-3 text-sm font-medium">Endereço de embarque/desembarque</p>
            <EnderecoFields issues={issues} />
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Período, escola e mensalidade são combinados depois, direto com o motorista, assim que você usar um
            código de convite pra vincular esse aluno a ele.
          </p>

          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass + " w-auto"} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className={primaryButtonClass + " w-auto sm:px-6"}>
              {loading ? "Adicionando…" : "Adicionar aluno"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
