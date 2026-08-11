"use client";

import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPatchJson, apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/ui/form-elements";
import { RotaMap } from "@/components/map/RotaMap";
import { useLocationSharingContext } from "@/contexts/LocationSharingContext";
import type { RotaResponse } from "@/app/api/motorista/rota/route";

type StatusEmbarque = "EMBARCOU" | "AUSENTE";
type EmbarqueRegistro = { vinculoId: string; status: StatusEmbarque };

// Recalcula sozinho enquanto a rota está ativa, mas com um intervalo bem
// mais espaçado que o envio de GPS (a cada 12s) — o cálculo de rota é uma
// chamada bem mais pesada (geocodificação já resolvida, mas o OSRM público
// tem uso justo limitado), então só faz sentido recalcular de tempos em
// tempos, não a cada atualização de posição.
const RECALCULO_AUTOMATICO_MS = 3 * 60_000;

type Escola = { id: string; nome: string };

function formatarDistancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatarDuracao(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, "0")}`;
}

type ResumoPercurso = {
  totalAlunos: number;
  totalEmbarcaram: number;
  totalAusentes: number;
  distanciaMetros: number | null;
};

export function RotaPanel() {
  const { isSharing, confirmAndRun, position } = useLocationSharingContext();
  const [rota, setRota] = useState<RotaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [resumoEncerrado, setResumoEncerrado] = useState<ResumoPercurso | null>(null);
  // Status de hoje (Embarcou/Ausente) por vínculo — persistido no servidor
  // (ver GET/PATCH /api/motorista/embarques), sobrevive a atualizar a
  // página, diferente do que era antes (só existia em memória).
  const [statusPorVinculo, setStatusPorVinculo] = useState<Record<string, StatusEmbarque>>({});

  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [escolaSelecionada, setEscolaSelecionada] = useState<string>("");
  // "" = rota normal (todos os alunos); id = modo "ir até uma escola".
  const [modoEscolaAtivo, setModoEscolaAtivo] = useState<string>("");

  const carregar = useCallback(async (escolaId?: string) => {
    setLoading(true);
    const url = escolaId ? `/api/motorista/rota?escolaId=${encodeURIComponent(escolaId)}` : "/api/motorista/rota";
    const result = await apiGet<RotaResponse>(url);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setRota(result.data);
  }, []);

  useEffect(() => {
    if (!isSharing) return;
    void carregar();

    apiGet<Escola[]>("/api/motorista/escolas").then((result) => {
      if (result.ok) {
        setEscolas(result.data);
        if (result.data[0]) setEscolaSelecionada(result.data[0].id);
      }
    });

    apiGet<EmbarqueRegistro[]>("/api/motorista/embarques").then((result) => {
      if (result.ok) {
        setStatusPorVinculo(Object.fromEntries(result.data.map((r) => [r.vinculoId, r.status])));
      }
    });

    // O recálculo automático só se aplica ao modo normal (todos os alunos)
    // — no modo "ir até escola" o motorista pediu explicitamente, não faz
    // sentido recalcular sozinho de tempos em tempos.
    const interval = setInterval(() => {
      if (!modoEscolaAtivo) void carregar();
    }, RECALCULO_AUTOMATICO_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSharing, carregar]);

  function irParaEscola() {
    if (!escolaSelecionada) return;
    setModoEscolaAtivo(escolaSelecionada);
    void carregar(escolaSelecionada);
  }

  function voltarRotaNormal() {
    setModoEscolaAtivo("");
    void carregar();
  }

  function encerrarRota() {
    confirmAndRun(async () => {
      setEncerrando(true);
      const result = await apiPostJson<ResumoPercurso>("/api/motorista/percurso/encerrar", {});
      setEncerrando(false);
      if (result.ok) {
        setResumoEncerrado(result.data);
        setStatusPorVinculo({});
      } else {
        setError(result.error);
      }
    });
  }

  async function marcarStatus(vinculoId: string, status: StatusEmbarque | null) {
    // Atualização otimista — a UI muda na hora, sem esperar a resposta.
    setStatusPorVinculo((prev) => {
      const next = { ...prev };
      if (status === null) delete next[vinculoId];
      else next[vinculoId] = status;
      return next;
    });

    const result = await apiPatchJson<{ ok: true }>("/api/motorista/embarques", { vinculoId, status });
    if (!result.ok) {
      // Reverte se a chamada falhar (ex: sem internet) — recarrega o estado
      // real do servidor em vez de tentar adivinhar o valor anterior.
      const retry = await apiGet<EmbarqueRegistro[]>("/api/motorista/embarques");
      if (retry.ok) setStatusPorVinculo(Object.fromEntries(retry.data.map((r) => [r.vinculoId, r.status])));
    }
  }

  if (!isSharing) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
        <h2 className="font-medium">Rota do dia</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Inicie o compartilhamento de localização acima para traçar a rota otimizada até os alunos.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">{modoEscolaAtivo ? `Indo para: ${rota?.modoEscola?.nome ?? "escola"}` : "Rota do dia"}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void carregar(modoEscolaAtivo || undefined)}
            disabled={loading}
            className={secondaryButtonClass + " w-auto px-4 py-1.5 text-sm"}
          >
            {loading ? "Calculando…" : "Recalcular rota"}
          </button>
          <button
            onClick={encerrarRota}
            disabled={encerrando}
            className={dangerButtonClass + " w-auto px-4 py-1.5 text-sm"}
          >
            {encerrando ? "Encerrando…" : "Encerrar rota"}
          </button>
        </div>
      </div>

      {resumoEncerrado && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
          <p className="font-medium">Rota encerrada e salva no relatório do dia.</p>
          <p className="mt-1">
            {resumoEncerrado.totalEmbarcaram} embarcaram · {resumoEncerrado.totalAusentes} ausentes ·{" "}
            {resumoEncerrado.totalAlunos} no total
            {resumoEncerrado.distanciaMetros !== null && (
              <> · {formatarDistancia(resumoEncerrado.distanciaMetros)} percorridos</>
            )}
          </p>
        </div>
      )}

      {escolas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800">
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300" htmlFor="escolaDestino">
              Ir direto para uma escola
            </label>
            <select
              id="escolaDestino"
              value={escolaSelecionada}
              onChange={(e) => setEscolaSelecionada(e.target.value)}
              className={inputClass}
            >
              {escolas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          {modoEscolaAtivo ? (
            <button onClick={voltarRotaNormal} className={secondaryButtonClass + " w-auto px-4 py-2"}>
              Voltar pra rota dos alunos
            </button>
          ) : (
            <button onClick={irParaEscola} className={primaryButtonClass + " w-auto px-4 py-2"}>
              Traçar rota até a escola
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {rota && rota.vinculosSemEndereco > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {rota.vinculosSemEndereco} responsável(is) vinculado(s) ainda não cadastrou endereço — não {rota.vinculosSemEndereco === 1 ? "entra" : "entram"} na rota.
        </p>
      )}

      {rota && rota.paradas.length === 0 && !error && (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Nenhuma parada com endereço cadastrado ainda.
        </p>
      )}

      {rota && rota.paradas.length > 0 && (
        <>
          {/* `isolate` evita que os controles internos do Leaflet
              (z-index até 1000) vazem por cima de menus/diálogos da
              aplicação — ver StopSharingDialog.tsx. */}
          <div className="isolate mt-3 h-[360px] overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
            <RotaMap
              // Posição "ao vivo" do GPS do navegador (atualiza a cada
              // poucos segundos) em vez da posição de quando a rota foi
              // calculada por último (só a cada 3 min) — é o que faz o
              // próprio motorista se ver de fato se movendo no mapa,
              // sem depender de recalcular a rota inteira no OSRM.
              motorista={position ?? rota.motorista}
              paradas={rota.paradas}
              concluidas={
                new Set(Object.entries(statusPorVinculo).filter(([, s]) => s === "EMBARCOU").map(([id]) => id))
              }
              geometria={rota.geometria}
            />
          </div>

          {rota.distanciaMetros !== null && rota.duracaoSegundos !== null && (
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {formatarDistancia(rota.distanciaMetros)} · aprox. {formatarDuracao(rota.duracaoSegundos)}
            </p>
          )}

          {!modoEscolaAtivo && (
            <ol className="mt-4 space-y-2">
              {rota.paradas.map((p) => {
                const status = statusPorVinculo[p.vinculoId];
                return (
                  <li
                    key={p.vinculoId}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                      status === "EMBARCOU"
                        ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                        : status === "AUSENTE"
                          ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                          : "border-neutral-200 dark:border-neutral-700"
                    }`}
                  >
                    <div className={`min-w-0 ${status ? "line-through opacity-60" : ""}`}>
                      <p className="font-medium">
                        {p.sequencia}. {p.alunoNome}
                        {status === "AUSENTE" && " (ausente hoje)"}
                      </p>
                      <p className="break-words text-neutral-500 dark:text-neutral-400">{p.enderecoResumo}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {status ? (
                        <button
                          onClick={() => void marcarStatus(p.vinculoId, null)}
                          className={secondaryButtonClass + " w-auto shrink-0 px-3 py-1.5 text-xs"}
                        >
                          Desfazer
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => void marcarStatus(p.vinculoId, "EMBARCOU")}
                            className={secondaryButtonClass + " w-auto shrink-0 px-3 py-1.5 text-xs"}
                          >
                            Embarcou
                          </button>
                          <button
                            onClick={() => void marcarStatus(p.vinculoId, "AUSENTE")}
                            className={secondaryButtonClass + " w-auto shrink-0 px-3 py-1.5 text-xs border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-400"}
                          >
                            Ausente
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
