"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserRound, GraduationCap, Wallet } from "lucide-react";

import { apiGet, apiPatchJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";

type Escola = { id: string; nome: string };

export type PerfilAlunoInicial = {
  dataNascimento: string | null; // "YYYY-MM-DD"
  genero: "MASCULINO" | "FEMININO" | "OUTRO" | null;
  periodo: "MANHA" | "TARDE" | "INTEGRAL" | "NOITE" | null;
  escolaId: string | null;
  valorMensalidade: number | null;
  diaPagamentoMensalidade: number | null;
  vigenciaInicio: string | null; // "YYYY-MM-DD"
  vigenciaFim: string | null;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function paraMesAno(iso: string | null): { mes: number; ano: number } | null {
  if (!iso) return null;
  const [ano, mes] = iso.split("-").map(Number);
  return { mes, ano };
}

function paraIso(mes: number | null, ano: number | null): string | null {
  if (!mes || !ano) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

const PASSOS = [
  { key: "pessoal", label: "Dados pessoais", icon: UserRound },
  { key: "escolar", label: "Dados escolares", icon: GraduationCap },
  { key: "pagamento", label: "Mensalidade", icon: Wallet },
] as const;

/**
 * Assistente de edição do perfil do aluno, em 3 etapas — mesma estrutura
 * das telas de referência que o motorista mandou (dados do passageiro →
 * dados escolares → dados de pagamento), só que aqui é "editar/completar"
 * em vez de "cadastrar do zero" (o Aluno já existe, criado pelo responsável
 * no cadastro dele — ver comentário no schema).
 */
export function EditarPerfilAlunoModal({
  vinculoId,
  nomeAluno,
  inicial,
  onClose,
}: {
  vinculoId: string;
  nomeAluno: string;
  inicial: PerfilAlunoInicial;
  onClose: () => void;
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});

  const [escolas, setEscolas] = useState<Escola[] | null>(null);

  const [dataNascimento, setDataNascimento] = useState(inicial.dataNascimento ?? "");
  const [genero, setGenero] = useState(inicial.genero ?? "");
  const [periodo, setPeriodo] = useState(inicial.periodo ?? "");
  const [escolaId, setEscolaId] = useState(inicial.escolaId ?? "");

  const vigenciaInicioInicial = useMemo(() => paraMesAno(inicial.vigenciaInicio), [inicial.vigenciaInicio]);
  const vigenciaFimInicial = useMemo(() => paraMesAno(inicial.vigenciaFim), [inicial.vigenciaFim]);
  const anoAtual = new Date().getFullYear();

  const [valorMensalidade, setValorMensalidade] = useState(
    inicial.valorMensalidade !== null ? String(inicial.valorMensalidade) : ""
  );
  const [diaPagamento, setDiaPagamento] = useState(
    inicial.diaPagamentoMensalidade !== null ? String(inicial.diaPagamentoMensalidade) : "5"
  );
  const [mesInicio, setMesInicio] = useState(vigenciaInicioInicial?.mes ?? new Date().getMonth() + 1);
  const [anoInicio, setAnoInicio] = useState(vigenciaInicioInicial?.ano ?? anoAtual);
  const [mesFim, setMesFim] = useState<number | "">(vigenciaFimInicial?.mes ?? "");
  const [anoFim, setAnoFim] = useState(vigenciaFimInicial?.ano ?? anoAtual);

  useEffect(() => {
    let ativo = true;
    apiGet<Escola[]>("/api/motorista/escolas").then((result) => {
      if (ativo && result.ok) setEscolas(result.data);
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  async function salvar(payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setIssues({});
    const result = await apiPatchJson(`/api/motorista/vinculos/${vinculoId}/perfil`, payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      setIssues(result.issues ?? {});
      return false;
    }
    return true;
  }

  async function handleContinuarPessoal() {
    const ok = await salvar({
      dataNascimento: dataNascimento || null,
      genero: genero || null,
    });
    if (ok) setPasso(1);
  }

  async function handleContinuarEscolar() {
    const ok = await salvar({
      periodo: periodo || null,
      escolaId: escolaId || null,
    });
    if (ok) setPasso(2);
  }

  async function handleFinalizar() {
    const ok = await salvar({
      valorMensalidade: valorMensalidade ? Number(valorMensalidade) : null,
      diaPagamentoMensalidade: diaPagamento ? Number(diaPagamento) : null,
      vigenciaInicio: paraIso(mesInicio, anoInicio),
      vigenciaFim: paraIso(mesFim || null, mesFim ? anoFim : null),
    });
    if (ok) {
      toast.success("Perfil do aluno atualizado.");
      router.refresh();
      onClose();
    }
  }

  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 1 + i);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Editar {nomeAluno}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        <div className="mb-5 flex items-center justify-center gap-2">
          {PASSOS.map((p, i) => (
            <div key={p.key} className="flex items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  i <= passo ? "bg-brand-navy text-white" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700"
                }`}
                title={p.label}
              >
                <p.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              {i < PASSOS.length - 1 && (
                <div className={`h-0.5 w-8 sm:w-12 ${i < passo ? "bg-brand-navy" : "bg-neutral-200 dark:bg-neutral-700"}`} />
              )}
            </div>
          ))}
        </div>

        <p className="mb-4 text-center text-sm text-neutral-500 dark:text-neutral-400">{PASSOS[passo].label}</p>

        {passo === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="dataNascimento">
                Data de nascimento (opcional)
              </label>
              <input
                id="dataNascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className={inputClass}
              />
              <FieldError message={issues.dataNascimento?.[0]} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="genero">
                Gênero
              </label>
              <select id="genero" value={genero} onChange={(e) => setGenero(e.target.value as typeof genero)} className={inputClass}>
                <option value="">Selecione o gênero</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMININO">Feminino</option>
                <option value="OUTRO">Outro</option>
              </select>
              <FieldError message={issues.genero?.[0]} />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className={secondaryButtonClass} disabled={saving}>
                Cancelar
              </button>
              <button type="button" onClick={handleContinuarPessoal} disabled={saving} className={primaryButtonClass + " sm:w-auto"}>
                {saving ? "Salvando…" : "Continuar"}
              </button>
            </div>
          </div>
        )}

        {passo === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="periodo">
                Período
              </label>
              <select id="periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)} className={inputClass}>
                <option value="">Selecione o período</option>
                <option value="MANHA">Manhã</option>
                <option value="TARDE">Tarde</option>
                <option value="INTEGRAL">Integral</option>
                <option value="NOITE">Noite</option>
              </select>
              <FieldError message={issues.periodo?.[0]} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="escolaId">
                Escola
              </label>
              <select id="escolaId" value={escolaId} onChange={(e) => setEscolaId(e.target.value)} className={inputClass} disabled={!escolas}>
                <option value="">{escolas ? "Selecione a escola" : "Carregando…"}</option>
                {escolas?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
              <FieldError message={issues.escolaId?.[0]} />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <button type="button" onClick={() => setPasso(0)} className={secondaryButtonClass} disabled={saving}>
                Voltar
              </button>
              <button type="button" onClick={handleContinuarEscolar} disabled={saving} className={primaryButtonClass + " sm:w-auto"}>
                {saving ? "Salvando…" : "Continuar"}
              </button>
            </div>
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="valorMensalidade">
                Valor da mensalidade (R$)
              </label>
              <input
                id="valorMensalidade"
                type="number"
                step="0.01"
                min="0"
                value={valorMensalidade}
                onChange={(e) => setValorMensalidade(e.target.value)}
                className={inputClass}
                placeholder="Ex.: 250,00"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Combinado direto com a família — não passa pela plataforma. Deixe em branco pra não gerar mensalidade automática.
              </p>
              <FieldError message={issues.valorMensalidade?.[0]} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="diaPagamento">
                Dia de pagamento
              </label>
              <select id="diaPagamento" value={diaPagamento} onChange={(e) => setDiaPagamento(e.target.value)} className={inputClass}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <FieldError message={issues.diaPagamentoMensalidade?.[0]} />
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Início da vigência</p>
              <div className="grid grid-cols-2 gap-3">
                <select value={mesInicio} onChange={(e) => setMesInicio(Number(e.target.value))} className={inputClass}>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select value={anoInicio} onChange={(e) => setAnoInicio(Number(e.target.value))} className={inputClass}>
                  {anos.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Fim da vigência (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                <select value={mesFim} onChange={(e) => setMesFim(e.target.value ? Number(e.target.value) : "")} className={inputClass}>
                  <option value="">Sem prazo definido</option>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={anoFim}
                  onChange={(e) => setAnoFim(Number(e.target.value))}
                  className={inputClass}
                  disabled={!mesFim}
                >
                  {anos.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <button type="button" onClick={() => setPasso(1)} className={secondaryButtonClass} disabled={saving}>
                Voltar
              </button>
              <button type="button" onClick={handleFinalizar} disabled={saving} className={primaryButtonClass + " sm:w-auto"}>
                {saving ? "Salvando…" : "Concluir"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
