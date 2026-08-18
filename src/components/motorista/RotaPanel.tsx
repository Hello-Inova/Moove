"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Navigation, X } from "lucide-react";

import { apiGet, apiPatchJson, apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/ui/form-elements";
import { RotaMap } from "@/components/map/RotaMap";
import { useLocationSharingContext } from "@/contexts/LocationSharingContext";
import { haversineMetros } from "@/lib/geo/distancia";
import type { ParadaRota, RotaResponse } from "@/app/api/motorista/rota/route";

type StatusEmbarque = "EMBARCOU" | "AUSENTE";
type EmbarqueRegistro = { vinculoId: string; status: StatusEmbarque };

// Recálculo automático da rota tem dois gatilhos: distância percorrida (o
// que de fato importa — a rota só muda de verdade quando o motorista se
// afasta o bastante do ponto onde ela foi traçada) e um teto de tempo como
// rede de segurança (cobre o caso raro de ficar parado tempo suficiente pra
// algo mudar por fora, ex: um responsável acabou de cadastrar endereço).
// Os dois respeitam o uso justo do OSRM público — não recalcula a cada
// atualização de GPS (12s), só quando um dos dois critérios bate.
const RECALCULO_DISTANCIA_MINIMA_M = 100;
const RECALCULO_COOLDOWN_MS = 30_000;
const RECALCULO_TETO_MS = 1 * 60_000;

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
  // null = rota normal (todos os alunos, ordem otimizada); preenchido = "ir
  // direto" pra um destino único — uma escola ou um aluno específico
  // (botão "Ir" de cada item da lista, estilo Uber/99 — ver render abaixo).
  const [destinoManual, setDestinoManual] = useState<{ tipo: "escola" | "aluno"; id: string } | null>(null);
  // Lista "estável" de paradas (todos os vínculos, ordem otimizada) usada
  // pra renderizar a lista de alunos com os botões Ir/Embarcou/Ausente —
  // independente do que está no mapa no momento (`rota`), pra continuar
  // visível mesmo com um destino único em foco (o motorista pode trocar de
  // aluno sem perder a lista completa).
  const [listaAlunos, setListaAlunos] = useState<ParadaRota[]>([]);

  // Posição (ao vivo, do GPS) e horário do último recálculo bem-sucedido —
  // é a partir daqui que decidimos se já andou longe/tempo o suficiente pra
  // valer a pena recalcular de novo. Refs porque só são lidos dentro de
  // callbacks/efeitos, não precisam disparar re-render sozinhos.
  const posicaoUltimoCalculoRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const ultimoCalculoEmRef = useRef<number>(0);
  const posicaoAtualRef = useRef(position);
  useEffect(() => {
    posicaoAtualRef.current = position;
  }, [position]);
  // Lido dentro do interval de segurança (ver efeito abaixo) — precisa ser
  // ref pra não ficar "preso" no valor de quando o interval foi criado.
  const destinoManualRef = useRef(destinoManual);
  useEffect(() => {
    destinoManualRef.current = destinoManual;
  }, [destinoManual]);

  const carregar = useCallback(async (destino?: { tipo: "escola" | "aluno"; id: string }) => {
    setLoading(true);
    const url = destino
      ? `/api/motorista/rota?${destino.tipo === "escola" ? "escolaId" : "vinculoId"}=${encodeURIComponent(destino.id)}`
      : "/api/motorista/rota";
    const result = await apiGet<RotaResponse>(url);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setRota(result.data);
    // Só atualiza a lista "estável" quando é a busca normal (multi-parada)
    // — uma busca de destino único tem só 1 parada e não deve substituir a
    // lista completa exibida abaixo do mapa.
    if (!destino) setListaAlunos(result.data.paradas);
    posicaoUltimoCalculoRef.current = posicaoAtualRef.current;
    ultimoCalculoEmRef.current = Date.now();
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

    // Rede de segurança independente do GPS: se por algum motivo o
    // navegador parar de disparar `watchPosition` (ex: parado, sem
    // movimento suficiente pro sensor considerar "mudou"), ainda garante um
    // recálculo periódico no modo normal — mesma garantia que já existia
    // antes do recálculo por distância.
    const tetoInterval = setInterval(() => {
      if (!destinoManualRef.current && Date.now() - ultimoCalculoEmRef.current >= RECALCULO_TETO_MS) {
        void carregar();
      }
    }, 30_000);
    return () => clearInterval(tetoInterval);
  }, [isSharing, carregar]);

  // Recálculo automático conforme o motorista se move — dispara quando ele
  // se afasta o bastante do ponto onde a rota foi traçada por último (não
  // a cada tick de GPS: teria custo alto no OSRM público pra um ganho
  // mínimo, já que a rota mal muda de um quarteirão pro outro). O teto de
  // tempo é só uma rede de segurança pro caso raro de ficar parado tempo
  // demais. Só se aplica ao modo normal — no modo "ir até escola" o
  // motorista pediu explicitamente, não faz sentido recalcular sozinho.
  useEffect(() => {
    if (!isSharing || destinoManual || loading || !position) return;

    const ultimaPosicao = posicaoUltimoCalculoRef.current;
    if (!ultimaPosicao) return; // ainda não teve o primeiro cálculo bem-sucedido

    const desdeUltimoCalculo = Date.now() - ultimoCalculoEmRef.current;
    if (desdeUltimoCalculo < RECALCULO_COOLDOWN_MS) return;

    const distanciaPercorrida = haversineMetros(ultimaPosicao, position);
    const deveRecalcular =
      distanciaPercorrida >= RECALCULO_DISTANCIA_MINIMA_M || desdeUltimoCalculo >= RECALCULO_TETO_MS;

    if (deveRecalcular) void carregar();
  }, [position, isSharing, destinoManual, loading, carregar]);

  function irParaEscola() {
    if (!escolaSelecionada) return;
    setDestinoManual({ tipo: "escola", id: escolaSelecionada });
    void carregar({ tipo: "escola", id: escolaSelecionada });
  }

  // Botão "Ir" de cada item da lista de alunos — traça a rota direto até
  // esse aluno (ignora a ordem otimizada dos demais), igual ao Uber/99.
  // O alerta de proximidade continua avaliando todos os vínculos ativos
  // pela config do motorista (ver /api/motorista/localizacao), não só o
  // que está em foco aqui — escolher "Ir" não muda quem recebe alerta.
  function irParaAluno(vinculoId: string) {
    setDestinoManual({ tipo: "aluno", id: vinculoId });
    void carregar({ tipo: "aluno", id: vinculoId });
  }

  function voltarRotaNormal() {
    setDestinoManual(null);
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
        <h2 className="font-medium">
          {destinoManual ? `Indo para: ${rota?.modoDestino?.nome ?? "..."}` : "Rota do dia"}
        </h2>
        <div className="flex flex-wrap gap-2">
          {destinoManual && (
            <button
              onClick={voltarRotaNormal}
              className={secondaryButtonClass + " w-auto px-4 py-1.5 text-sm"}
            >
              Voltar pra rota normal
            </button>
          )}
          <button
            onClick={() => void carregar(destinoManual ?? undefined)}
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
          {destinoManual?.tipo !== "escola" && (
            <button onClick={irParaEscola} className={primaryButtonClass + " w-auto px-4 py-2"}>
              Traçar rota até a escola
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {rota && rota.vinculosSemEndereco > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {rota.vinculosSemEndereco} aluno(s) vinculado(s) ainda não {rota.vinculosSemEndereco === 1 ? "tem" : "têm"} endereço cadastrado — não {rota.vinculosSemEndereco === 1 ? "entra" : "entram"} na rota.
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

          {destinoManual?.tipo !== "escola" && listaAlunos.length > 0 && (
            <ol className="mt-4 space-y-2">
              {listaAlunos.map((p) => {
                const status = statusPorVinculo[p.vinculoId];
                const emFoco = destinoManual?.tipo === "aluno" && destinoManual.id === p.vinculoId;
                return (
                  <li
                    key={p.vinculoId}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                      emFoco
                        ? "border-brand-orange bg-orange-50 dark:border-brand-orange dark:bg-orange-950/20"
                        : status === "EMBARCOU"
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
                      <button
                        onClick={() => (emFoco ? voltarRotaNormal() : irParaAluno(p.vinculoId))}
                        className={
                          (emFoco ? secondaryButtonClass : primaryButtonClass) +
                          " inline-flex w-auto shrink-0 items-center gap-1 px-3 py-1.5 text-xs"
                        }
                      >
                        {emFoco ? (
                          <>
                            <X className="h-3.5 w-3.5" /> Cancelar
                          </>
                        ) : (
                          <>
                            <Navigation className="h-3.5 w-3.5" /> Ir
                          </>
                        )}
                      </button>
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
