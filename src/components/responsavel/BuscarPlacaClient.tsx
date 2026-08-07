"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { apiGet } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";
import { VehicleMap } from "@/components/map/VehicleMap";

type BuscaResponse = {
  veiculo: { placa: string; modelo: string };
  motorista: { nome: string };
  localizacao: { latitude: number; longitude: number; atualizadoEm: string; desatualizada: boolean } | null;
};

const POLL_INTERVAL_MS = 10_000;

export function BuscarPlacaClient({ placaInicial }: { placaInicial?: string }) {
  const [placaInput, setPlacaInput] = useState(placaInicial ?? "");
  const [placaAtiva, setPlacaAtiva] = useState<string | null>(null);
  const [data, setData] = useState<BuscaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const placa = placaInput.trim().toUpperCase();
    if (!placa) return;
    setPlacaAtiva(placa);
  }

  useEffect(() => {
    if (!placaAtiva) return;

    setLoading(true);
    buscar(placaAtiva).finally(() => setLoading(false));

    intervalRef.current = setInterval(() => {
      void buscar(placaAtiva);
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [placaAtiva, buscar]);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-sm font-medium" htmlFor="placa">
            Placa do veículo
          </label>
          <input
            id="placa"
            value={placaInput}
            onChange={(e) => setPlacaInput(e.target.value)}
            placeholder="ABC1D23"
            className={inputClass + " uppercase"}
          />
        </div>
        <button type="submit" className={primaryButtonClass + " w-auto px-6"}>
          Buscar
        </button>
      </form>

      {loading && !data && !error && <p className="text-sm text-neutral-500">Buscando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
            <p className="font-medium">
              {data.veiculo.placa} · {data.veiculo.modelo}
            </p>
            <p className="text-sm text-neutral-500">Motorista: {data.motorista.nome}</p>
          </div>

          {data.localizacao ? (
            <>
              {data.localizacao.desatualizada && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Localização desatualizada — o motorista pode ter desligado o GPS ou minimizado o app.
                  Última atualização às{" "}
                  {new Date(data.localizacao.atualizadoEm).toLocaleTimeString("pt-BR")}.
                </p>
              )}
              <div className="h-[420px] overflow-hidden rounded-xl border border-neutral-200">
                <VehicleMap
                  latitude={data.localizacao.latitude}
                  longitude={data.localizacao.longitude}
                  label={`${data.veiculo.placa} — ${data.motorista.nome}`}
                />
              </div>
            </>
          ) : (
            <p className="rounded-lg bg-neutral-100 px-3 py-3 text-sm text-neutral-600">
              Sem localização no momento. O motorista ainda não iniciou o compartilhamento de GPS
              nesta sessão.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
