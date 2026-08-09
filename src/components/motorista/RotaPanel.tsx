"use client";

import { useCallback, useEffect, useState } from "react";

import { apiGet } from "@/lib/api-client";
import { secondaryButtonClass } from "@/components/ui/form-elements";
import { RotaMap } from "@/components/map/RotaMap";
import { useLocationSharingContext } from "@/contexts/LocationSharingContext";
import type { RotaResponse } from "@/app/api/motorista/rota/route";

// Recalcula sozinho enquanto a rota está ativa, mas com um intervalo bem
// mais espaçado que o envio de GPS (a cada 12s) — o cálculo de rota é uma
// chamada bem mais pesada (geocodificação já resolvida, mas o OSRM público
// tem uso justo limitado), então só faz sentido recalcular de tempos em
// tempos, não a cada atualização de posição.
const RECALCULO_AUTOMATICO_MS = 3 * 60_000;

function formatarDistancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatarDuracao(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, "0")}`;
}

export function RotaPanel() {
  const { isSharing } = useLocationSharingContext();
  const [rota, setRota] = useState<RotaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concluidas, setConcluidas] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setLoading(true);
    const result = await apiGet<RotaResponse>("/api/motorista/rota");
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

    const interval = setInterval(() => void carregar(), RECALCULO_AUTOMATICO_MS);
    return () => clearInterval(interval);
  }, [isSharing, carregar]);

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
        <h2 className="font-medium">Rota do dia</h2>
        <button onClick={() => void carregar()} disabled={loading} className={secondaryButtonClass + " w-auto px-4 py-1.5 text-sm"}>
          {loading ? "Calculando…" : "Recalcular rota"}
        </button>
      </div>

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
            <RotaMap motorista={rota.motorista} paradas={rota.paradas} concluidas={concluidas} geometria={rota.geometria} />
          </div>

          {rota.distanciaMetros !== null && rota.duracaoSegundos !== null && (
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {formatarDistancia(rota.distanciaMetros)} · aprox. {formatarDuracao(rota.duracaoSegundos)}
            </p>
          )}

          <ol className="mt-4 space-y-2">
            {rota.paradas.map((p) => {
              const concluida = concluidas.has(p.vinculoId);
              return (
                <li
                  key={p.vinculoId}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                    concluida
                      ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
                      : "border-neutral-200 dark:border-neutral-700"
                  }`}
                >
                  <div className={concluida ? "line-through opacity-60" : ""}>
                    <p className="font-medium">
                      {p.sequencia}. {p.responsavelNome}
                    </p>
                    <p className="text-neutral-500 dark:text-neutral-400">{p.enderecoResumo}</p>
                  </div>
                  <button
                    onClick={() =>
                      setConcluidas((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.vinculoId)) next.delete(p.vinculoId);
                        else next.add(p.vinculoId);
                        return next;
                      })
                    }
                    className={secondaryButtonClass + " w-auto shrink-0 px-3 py-1.5 text-xs"}
                  >
                    {concluida ? "Desfazer" : "Embarcou"}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
