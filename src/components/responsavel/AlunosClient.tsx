"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, CheckCircle2, Plus } from "lucide-react";

import { apiGet, apiDelete } from "@/lib/api-client";
import { secondaryButtonClass, primaryButtonClass, dangerButtonClass } from "@/components/ui/form-elements";
import { EditarEnderecoAlunoModal } from "@/components/responsavel/EditarEnderecoAlunoModal";
import { NovoAlunoModal, type AlunoCriado } from "@/components/responsavel/NovoAlunoModal";
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
  dataNascimento: string | null;
  genero: "MASCULINO" | "FEMININO" | "OUTRO" | null;
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

// `dataNascimento` chega como "YYYY-MM-DD" puro (sem hora) — formata direto
// da string, sem passar por `new Date(...)`, pra não correr risco nenhum de
// fuso horário deslocar o dia (mesmo cuidado documentado no Painel).
function formatarDataNascimento(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function AlunosClient() {
  const confirm = useConfirm();
  const [alunos, setAlunos] = useState<Aluno[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editandoEnderecoDe, setEditandoEnderecoDe] = useState<Aluno | null>(null);
  const [novoAlunoAberto, setNovoAlunoAberto] = useState(false);

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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Meus alunos</h2>
          <button
            type="button"
            onClick={() => setNovoAlunoAberto(true)}
            className={primaryButtonClass + " inline-flex w-auto items-center gap-1.5 px-3.5 py-1.5 text-sm"}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo aluno
          </button>
        </div>

        {!alunos && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}
        {alunos && alunos.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum aluno cadastrado ainda. Toque em &quot;Novo aluno&quot; para começar.
          </p>
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
                    {a.dataNascimento && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Nascimento: {formatarDataNascimento(a.dataNascimento)}
                      </p>
                    )}
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
      </section>

      {novoAlunoAberto && (
        <NovoAlunoModal
          onClose={() => setNovoAlunoAberto(false)}
          onCriado={(aluno: AlunoCriado) => {
            setNovoAlunoAberto(false);
            void carregar();
            // Alerta de confirmação de endereço logo após o cadastro (item
            // 9): abre direto o mapa pra confirmar o pino, já que é o
            // endereço que o motorista vai usar pra traçar a parada.
            toast.message("Confirme o endereço de embarque/desembarque no mapa.");
            setEditandoEnderecoDe({
              id: aluno.id,
              nome: aluno.nome,
              dataNascimento: aluno.dataNascimento,
              genero: aluno.genero,
              vinculado: aluno.vinculado,
              motoristaNome: aluno.motoristaNome,
              escolaNome: aluno.escolaNome,
              endereco: aluno.endereco,
            });
          }}
        />
      )}

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
