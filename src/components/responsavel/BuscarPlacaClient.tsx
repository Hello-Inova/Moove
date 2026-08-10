"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiGet } from "@/lib/api-client";
import { inputClass } from "@/components/ui/form-elements";
import { VehicleMap } from "@/components/map/VehicleMap";
import type { BuscaPlacaResponse } from "@/app/api/responsavel/buscar-placa/route";

type Vinculo = {
  id: string;
  status: "ATIVO" | "REVOGADO";
  alunoNome: string;
  motoristaNome: string;
  veiculos: { placa: string; modelo: string }[];
};

type BuscaResponse = BuscaPlacaResponse;

function formatarDistancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatarDuracao(s: number): string {
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, "0")}`;
}

type Opcao = { placa: string; modelo: string; motoristaNome: string; alunoNome: string };

const POLL_INTERVAL_MS = 10_000;

export function BuscarPlacaClient({ placaInicial }: { placaInicial?: string }) {
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null);
  const [opcoesError, setOpcoesError] = useState<string | null>(null);

  const [placaSelecionada, setPlacaSelecionada] = useState<string>(placaInicial ?? "");
  const [data, setData] = useState<BuscaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Monta as opções do select a partir dos vínculos ATIVOS do responsável —
  // um item por veículo do motorista vinculado, identificado pelo nome do
  // motorista (a placa continua sendo a chave usada na busca por trás dos
  // panos, só deixou de ser digitada manualmente).
  useEffect(() => {
    let cancelado = false;
    apiGet<Vinculo[]>("/api/responsavel/vinculos").then((result) => {
      if (cancelado) return;
      if (!result.ok) {
        setOpcoesError(result.error);
        return;
      }
      const lista: Opcao[] = result.data
        .filter((v) => v.status === "ATIVO")
        .flatMap((v) =>
          v.veiculos.map((ve) => ({ placa: ve.placa, modelo: ve.modelo, motoristaNome: v.motoristaNome, alunoNome: v.alunoNome }))
        );
      setOpcoes(lista);

      if (!placaSelecionada && lista.length > 0) {
        setPlacaSelecionada(lista[0].placa);
      }
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscar = useCallback(async (placa: string) => {
    const result = await apiGet<BuscaResponse>(`/api/responsavel/buscar-placa?placa=${encodeURIComponent(placa)}`);
    if (!result.ok) {
      setError(result.error);
      setData(null);
      // Se o vínculo foi revogado no meio do polling, paramos de tentar.
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    setError(null);
    setData(result.data);
  }, []);

  useEffect(() => {
    if (!placaSelecionada) return;

    setLoading(true);
    setData(null);
    buscar(placaSelecionada).finally(() => setLoading(false));

    intervalRef.current = setInterval(() => {
      void buscar(placaSelecionada);
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [placaSelecionada, buscar]);

  return (
    <div className="space-y-6">
      {opcoesError && <p className="text-sm text-red-600">{opcoesError}</p>}

      {opcoes && opcoes.length === 0 && !opcoesError && (
        <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          Você ainda não tem vínculo ativo com nenhum motorista que tenha veículo cadastrado.
        </p>
      )}

      {opcoes && opcoes.length > 0 && (
        <div className="max-w-sm">
          <label className="mb-1 block text-sm font-medium" htmlFor="motorista">
            Aluno / motorista
          </label>
          <select
            id="motorista"
            value={placaSelecionada}
            onChange={(e) => setPlacaSelecionada(e.target.value)}
            className={inputClass}
          >
            {opcoes.map((o) => (
              <option key={o.placa + o.alunoNome} value={o.placa}>
                {o.alunoNome} — {o.motoristaNome} · {o.placa}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && !data && !error && <p className="text-sm text-neutral-500 dark:text-neutral-400">Buscando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <p className="font-medium">
              {data.veiculo.placa} · {data.veiculo.modelo}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Motorista: {data.motorista.nome}</p>
          </div>

          {data.localizacao ? (
            <>
              {data.localizacao.desatualizada && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Localização desatualizada — o motorista pode ter desligado o GPS ou minimizado o app.
                  Última atualização às{" "}
                  {new Date(data.localizacao.atualizadoEm).toLocaleTimeString("pt-BR")}.
                </p>
              )}
              {!data.rota && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Cadastre seu endereço em &quot;Meu endereço&quot; para ver o trajeto do motorista até você no mapa.
                </p>
              )}

              {data.rota && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatarDistancia(data.rota.distanciaMetros)} · aprox. {formatarDuracao(data.rota.duracaoSegundos)} até o seu endereço
                </p>
              )}

              {/* `isolate` cria um novo contexto de empilhamento pro mapa —
                  o Leaflet usa z-index até 1000 nos próprios controles, e
                  sem isso ele pode ficar por cima de menus/diálogos da
                  aplicação (ex: alerta de encerrar rota) que usam z-index
                  mais baixos. */}
              <div className="isolate h-[420px] overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
                <VehicleMap
                  latitude={data.localizacao.latitude}
                  longitude={data.localizacao.longitude}
                  label={`${data.veiculo.placa} — ${data.motorista.nome}`}
                  destino={data.rota?.destino ?? null}
                  geometria={data.rota?.geometria ?? null}
                />
              </div>
            </>
          ) : (
            <p className="rounded-lg bg-neutral-100 px-3 py-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Sem localização no momento. O motorista ainda não iniciou o compartilhamento de GPS
              nesta sessão.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
