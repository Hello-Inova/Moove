"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MapPin, CheckCircle2 } from "lucide-react";

import { apiGet, apiPostJson, apiDelete } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/ui/form-elements";
import { EnderecoFields } from "@/components/ui/EnderecoFields";
import { EditarEnderecoAlunoModal } from "@/components/responsavel/EditarEnderecoAlunoModal";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { Skeleton } from "@/components/ui/Skeleton";

type EnderecoAluno = {
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

type Aluno = {
  id: string;
  nome: string;
  vinculado: boolean;
  motoristaNome: string | null;
  escolaNome: string | null;
  endereco: EnderecoAluno;
};

function resumoEndereco(e: EnderecoAluno): string | null {
  const partes = [
    e.logradouro && `${e.logradouro}${e.numero ? `, ${e.numero}` : ""}`,
    e.bairro,
    e.cidade && e.estado && `${e.cidade} - ${e.estado}`,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}

export function AlunosClient() {
  const confirm = useConfirm();
  const [alunos, setAlunos] = useState<Aluno[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [editandoEnderecoDe, setEditandoEnderecoDe] = useState<Aluno | null>(null);

  const carregar = useCallback(async () => {
    const alunosResult = await apiGet<Aluno[]>("/api/responsavel/alunos");

    if (!alunosResult.ok) {
      setLoadError(alunosResult.error);
      return;
    }
    setAlunos(alunosResult.data);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const payload = {
      nome: form.get("nome"),
      cep: form.get("cep"),
      logradouro: form.get("logradouro"),
      numero: form.get("numero"),
      complemento: form.get("complemento"),
      bairro: form.get("bairro"),
      cidade: form.get("cidade"),
      estado: form.get("estado"),
    };
    const result = await apiPostJson<Aluno>("/api/responsavel/alunos", payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    event.currentTarget.reset();
    toast.success("Aluno adicionado.");
    void carregar();
  }

  async function handleDelete(id: string, nome: string) {
    if (!(await confirm(`Remover "${nome}" da sua lista de alunos?`, { danger: true, confirmLabel: "Remover" }))) return;
    const result = await apiDelete(`/api/responsavel/alunos/${id}`);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Aluno removido.");
    void carregar();
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-3 font-medium">Meus alunos</h2>

        {!alunos && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}
        {alunos && alunos.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum aluno cadastrado ainda.</p>
        )}

        <ul className="space-y-2">
          {alunos?.map((a) => {
            const geocodificado = a.endereco.enderecoLatitude !== null && a.endereco.enderecoLongitude !== null;
            const resumo = resumoEndereco(a.endereco);
            return (
              <li
                key={a.id}
                className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.nome}</p>
                    {a.vinculado ? (
                      <p className="text-neutral-500 dark:text-neutral-400">
                        Vinculado a {a.motoristaNome}
                        {a.escolaNome ? ` · ${a.escolaNome}` : ""}
                      </p>
                    ) : (
                      <p className="text-neutral-500 dark:text-neutral-400">Ainda não vinculado a um motorista</p>
                    )}
                  </div>
                  {!a.vinculado && (
                    <button onClick={() => handleDelete(a.id, a.nome)} className={dangerButtonClass + " w-auto px-3 py-1.5 text-xs"}>
                      Remover
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-800">
                  <div className="flex min-w-0 items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                    <div className="min-w-0">
                      {resumo ? (
                        <p className="truncate text-xs text-neutral-600 dark:text-neutral-300">{resumo}</p>
                      ) : (
                        <p className="text-xs text-amber-700 dark:text-amber-400">Endereço não cadastrado.</p>
                      )}
                      {resumo && !geocodificado && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">Não localizado no mapa ainda.</p>
                      )}
                      {resumo && geocodificado && !a.endereco.enderecoConfirmado && (
                        <p className="text-xs text-amber-700 dark:text-amber-400">Pino ainda não confirmado.</p>
                      )}
                      {resumo && geocodificado && a.endereco.enderecoConfirmado && (
                        <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Confirmado
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditandoEnderecoDe(a)}
                    className={secondaryButtonClass + " w-auto shrink-0 px-3 py-1.5 text-xs"}
                  >
                    {resumo ? "Editar endereço" : "Cadastrar endereço"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-700" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="nome">
              Nome do aluno
            </label>
            <input id="nome" name="nome" required className={inputClass} />
            <FieldError message={issues.nome?.[0]} />
          </div>

          <div>
            <p className="mb-3 text-sm font-medium">Endereço de embarque/desembarque</p>
            <EnderecoFields issues={issues} />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button type="submit" disabled={loading} className={primaryButtonClass + " sm:w-auto sm:px-6"}>
            {loading ? "Adicionando…" : "Adicionar aluno"}
          </button>
        </form>
      </section>

      {editandoEnderecoDe && (
        <EditarEnderecoAlunoModal
          alunoId={editandoEnderecoDe.id}
          nomeAluno={editandoEnderecoDe.nome}
          defaultValues={{
            cep: editandoEnderecoDe.endereco.cep ?? "",
            logradouro: editandoEnderecoDe.endereco.logradouro ?? "",
            numero: editandoEnderecoDe.endereco.numero ?? "",
            complemento: editandoEnderecoDe.endereco.complemento ?? "",
            bairro: editandoEnderecoDe.endereco.bairro ?? "",
            cidade: editandoEnderecoDe.endereco.cidade ?? "",
            estado: editandoEnderecoDe.endereco.estado ?? "",
          }}
          geocodificado={editandoEnderecoDe.endereco.enderecoLatitude !== null && editandoEnderecoDe.endereco.enderecoLongitude !== null}
          enderecoLatitude={editandoEnderecoDe.endereco.enderecoLatitude}
          enderecoLongitude={editandoEnderecoDe.endereco.enderecoLongitude}
          enderecoConfirmado={editandoEnderecoDe.endereco.enderecoConfirmado}
          onClose={() => {
            setEditandoEnderecoDe(null);
            void carregar();
          }}
        />
      )}
    </div>
  );
}
