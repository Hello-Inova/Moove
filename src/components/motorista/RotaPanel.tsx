"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Navigation, X } from "lucide-react";

import { apiGet, apiPatchJson, apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/ui/form-elements";
import { RotaMap } from "@/components/map/RotaMap";
import { useLocationSharingContext } from "@/contexts/LocationSharingContext";
import type { ParadaRota, RotaResponse } from "@/app/api/motorista/rota/route";

type StatusEmbarque = "EMBARCOU" | "AUSENTE";
type EmbarqueRegistro = { vinculoId: string; status: StatusEmbarque };
type Sentido = "IDA" | "VOLTA";

function embarquesUrl(sentido: Sentido): string {
  return `/api/motorista/embarques?sentido=${sentido === "VOLTA" ? "volta" : "ida"}`;
}

// Não há mais rota multi-parada pré-calculada (ver route.ts) — o mapa, no
// modo normal, só mostra os balões (motorista + alunos), sem custo de
// OSRM. Esse teto é só uma rede de segurança pra manter a LISTA de alunos
// atualizada (ex.: um responsável acabou de cadastrar endereço), não pra
// recalcular nenhum trajeto.
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
  // IDA = buscar os alunos em casa (padrão); VOLTA = buscar nas escolas
  // cadastradas em cada vínculo — botão "Retorno" abaixo. Cada sentido tem
  // sua própria marcação de Embarcou/Ausente (ver embarquesUrl acima).
  const [sentido, setSentido] = useState<Sentido>("IDA");

  // Horário da última busca bem-sucedida — usado só pelo teto de segurança
  // abaixo (mantém a LISTA de alunos atualizada, não recalcula rota).
  const ultimoCalculoEmRef = useRef<number>(0);
  // Lidos dentro do interval de segurança (ver efeito abaixo) — precisam
  // ser refs pra não ficar "presos" no valor de quando o interval foi
  // criado.
  const destinoManualRef = useRef(destinoManual);
  useEffect(() => {
    destinoManualRef.current = destinoManual;
  }, [destinoManual]);
  const sentidoRef = useRef(sentido);
  useEffect(() => {
    sentidoRef.current = sentido;
  }, [sentido]);

  const carregar = useCallback(async (destino?: { tipo: "escola" | "aluno"; id: string }, sentidoParam: Sentido = "IDA") => {
    setLoading(true);
    const params = new URLSearchParams();
    if (destino) params.set(destino.tipo === "escola" ? "escolaId" : "vinculoId", destino.id);
    if (sentidoParam === "VOLTA") params.set("sentido", "volta");
    const qs = params.toString();
    const result = await apiGet<RotaResponse>(`/api/motorista/rota${qs ? `?${qs}` : ""}`);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setRota(result.data);
    // Só atualiza a lista "estável" quando é a busca normal (todos os
    // alunos) — uma busca de destino único tem só 1 parada e não deve
    // substituir a lista completa exibida abaixo do mapa.
    if (!destino) setListaAlunos(result.data.paradas);
    ultimoCalculoEmRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!isSharing) return;
    void carregar(undefined, sentidoRef.current);

    apiGet<Escola[]>("/api/motorista/escolas").then((result) => {
      if (result.ok) {
        setEscolas(result.data);
        if (result.data[0]) setEscolaSelecionada(result.data[0].id);
      }
    });

    apiGet<EmbarqueRegistro[]>(embarquesUrl(sentidoRef.current)).then((result) => {
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
        void carregar(undefined, sentidoRef.current);
      }
    }, 30_000);
    return () => clearInterval(tetoInterval);
  }, [isSharing, carregar]);

  function irParaEscola() {
    if (!escolaSelecionada) return;
    setDestinoManual({ tipo: "escola", id: escolaSelecionada });
    void carregar({ tipo: "escola", id: escolaSelecionada }, sentido);
  }

  // Botão "Ir" de cada item da lista de alunos — traça a rota direto até
  // esse aluno (ignora a ordem otimizada dos demais), igual ao Uber/99. No
  // sentido VOLTA, "esse aluno" vira a escola cadastrada no vínculo dele
  // (ver rotaAteVinculo no backend). O alerta de proximidade continua
  // avaliando todos os vínculos ativos pela config do motorista (ver
  // /api/motorista/localizacao), não só o que está em foco aqui —
  // escolher "Ir" não muda quem recebe alerta.
  function irParaAluno(vinculoId: string) {
    setDestinoManual({ tipo: "aluno", id: vinculoId });
    void carregar({ tipo: "aluno", id: vinculoId }, sentido);
  }

  function voltarRotaNormal() {
    setDestinoManual(null);
    void carregar(undefined, sentido);
  }

  // Botão "Retorno" — troca entre buscar os alunos em casa (ida, padrão) e
  // buscar nas escolas cadastradas (volta). Reseta qualquer destino manual
  // em foco (ele valia pro sentido anterior) e recarrega tanto a lista de
  // alunos quanto a marcação de Embarcou/Ausente do novo sentido.
  function alternarSentido() {
    const novo: Sentido = sentido === "IDA" ? "VOLTA" : "IDA";
    setSentido(novo);
    setDestinoManual(null);
    void carregar(undefined, novo);
    apiGet<EmbarqueRegistro[]>(embarquesUrl(novo)).then((result) => {
      if (result.ok) setStatusPorVinculo(Object.fromEntries(result.data.map((r) => [r.vinculoId, r.status])));
    });
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

    const result = await apiPatchJson<{ ok: true }>("/api/motorista/embarques", { vinculoId, status, sentido });
    if (!result.ok) {
      // Reverte se a chamada falhar (ex: sem internet) — recarrega o estado
      // real do servidor em vez de tentar adivinhar o valor anterior.
      const retry = await apiGet<EmbarqueRegistro[]>(embarquesUrl(sentido));
      if (retry.ok) setStatusPorVinculo(Object.fromEntries(retry.data.map((r) => [r.vinculoId, r.status])));
      return;
    }

    // No sentido VOLTA, marcar/desmarcar "Embarcou" muda a FASE desse aluno
    // (buscar na escola -> levar pra casa, e vice-versa se desfizer — ver
    // rotaAteVinculo/listaVolta no backend) — recarrega o destino em foco
    // (ou a lista toda) pra o mapa refletir isso na hora, sem esperar o
    // refresh periódico.
    if (destinoManual?.tipo === "aluno" && destinoManual.id === vinculoId) {
      void carregar({ tipo: "aluno", id: vinculoId }, sentido);
    } else {
      void carregar(undefined, sentido);
    }
  }

  if (!isSharing) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
        <h2 className="font-medium">Rota do dia</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Inicie o compartilhamento de localização acima para ver os alunos no mapa e escolher pra qual ir primeiro.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">
          {destinoManual
            ? `Indo para: ${rota?.modoDestino?.nome ?? "..."}`
            : sentido === "VOLTA"
              ? "Retorno — buscando nas escolas"
              : "Rota do dia"}
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
            onClick={alternarSentido}
            disabled={loading}
            className={
              (sentido === "VOLTA"
                ? "border-brand-orange bg-orange-50 text-orange-900 hover:bg-orange-100 dark:border-brand-orange dark:bg-orange-950/30 dark:text-orange-300"
                : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700") +
              " w-auto rounded-xl border px-4 py-1.5 text-sm font-medium shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {sentido === "VOLTA" ? "Cancelar retorno" : "Iniciar retorno"}
          </button>
          <button
            onClick={() => void carregar(destinoManual ?? undefined, sentido)}
            disabled={loading}
            className={secondaryButtonClass + " w-auto px-4 py-1.5 text-sm"}
          >
            {destinoManual
              ? loading
                ? "Calculando…"
                : "Recalcular rota"
              : loading
                ? "Atualizando…"
                : "Atualizar lista"}
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

      {/* Redundante no modo Retorno: lá cada "Ir" já leva pra escola do
          próprio aluno — esse seletor é só pra "ir direto pra uma escola"
          fora do fluxo normal, faz sentido só na ida. */}
      {sentido === "IDA" && escolas.length > 0 && (
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
          {sentido === "VOLTA"
            ? <>{rota.vinculosSemEndereco} aluno(s) ainda sem escola cadastrada (com endereço) no vínculo — não {rota.vinculosSemEndereco === 1 ? "entra" : "entram"} no retorno.</>
            : <>{rota.vinculosSemEndereco} aluno(s) vinculado(s) ainda não {rota.vinculosSemEndereco === 1 ? "tem" : "têm"} endereço cadastrado — não {rota.vinculosSemEndereco === 1 ? "entra" : "entram"} na rota.</>}
        </p>
      )}

      {rota && rota.paradas.length === 0 && !error && (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          {sentido === "VOLTA"
            ? "Nenhum aluno com escola cadastrada (com endereço) ainda."
            : "Nenhuma parada com endereço cadastrado ainda."}
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
              ausentes={
                new Set(Object.entries(statusPorVinculo).filter(([, s]) => s === "AUSENTE").map(([id]) => id))
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
                // No sentido VOLTA, "Embarcou" não é o fim da linha — o
                // aluno já foi buscado na escola, mas ainda falta entregar
                // em casa (é essa segunda fase que muda o destino do "Ir",
                // ver rotaAteVinculo/listaVolta) — então não some/apaga o
                // item, só na ida (aí sim não tem mais ação pendente) ou
                // quando marcado ausente (em qualquer sentido).
                const semAcaoPendente = status === "AUSENTE" || (status === "EMBARCOU" && sentido === "IDA");
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
                    <div className={`min-w-0 ${semAcaoPendente ? "line-through opacity-60" : ""}`}>
                      <p className="font-medium">
                        {p.alunoNome}
                        {status === "AUSENTE" && " (ausente hoje)"}
                        {status === "EMBARCOU" && sentido === "VOLTA" && " (a caminho de casa)"}
                      </p>
                      <p className="break-words text-neutral-500 dark:text-neutral-400">{p.enderecoResumo}</p>
                    </div>
                    {/* `flex-nowrap` + largura fixa igual (w-24) em todos os
                        botões — ficam sempre na mesma linha, um do lado do
                        outro. Esse bloco de botões inteiro ainda pode
                        quebrar pra debaixo do texto no card (o <li> pai é
                        `flex-wrap`), então continua cabendo em telas de
                        celular sem forçar scroll horizontal. */}
                    <div className="flex flex-nowrap gap-2">
                      <button
                        onClick={() => (emFoco ? voltarRotaNormal() : irParaAluno(p.vinculoId))}
                        className={
                          emFoco
                            ? secondaryButtonClass + " inline-flex w-24 shrink-0 items-center justify-center gap-1 px-2 py-1.5 text-xs"
                            // Não usa primaryButtonClass aqui: ele embute `w-full`, que na
                            // ordem de geração do Tailwind vence qualquer largura acrescentada
                            // depois na string — por isso o botão ficava esticado. Reescreve
                            // o mesmo visual (navy, preenchido) sem a largura total.
                            : "inline-flex w-24 shrink-0 items-center justify-center gap-1 rounded-xl bg-brand-navy px-2 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-navy-light active:scale-[0.99]"
                        }
                      >
                        {emFoco ? (
                          <X className="h-3.5 w-3.5" />
                        ) : (
                          <>
                            <Navigation className="h-3.5 w-3.5" /> Ir
                          </>
                        )}
                      </button>
                      {status ? (
                        <button
                          onClick={() => void marcarStatus(p.vinculoId, null)}
                          className={secondaryButtonClass + " w-24 shrink-0 text-center px-2 py-1.5 text-xs"}
                        >
                          Desfazer
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => void marcarStatus(p.vinculoId, "EMBARCOU")}
                            className={secondaryButtonClass + " w-24 shrink-0 text-center px-2 py-1.5 text-xs"}
                          >
                            Embarcou
                          </button>
                          <button
                            onClick={() => void marcarStatus(p.vinculoId, "AUSENTE")}
                            className={secondaryButtonClass + " w-24 shrink-0 text-center px-2 py-1.5 text-xs border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-400"}
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
