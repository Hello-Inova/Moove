"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPatchJson } from "@/lib/api-client";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { EnderecoFields, type EnderecoValores } from "@/components/ui/EnderecoFields";
import { PinPicker } from "@/components/map/PinPicker";

type Coords = { latitude: number; longitude: number };

type SalvarResposta = {
  ok: true;
  geocodificado: boolean;
  enderecoLatitude: number | null;
  enderecoLongitude: number | null;
  enderecoTextoEncontrado: string | null;
  centroAproximado: Coords | null;
};

export function EnderecoForm({
  defaultValues,
  geocodificado,
  enderecoLatitude,
  enderecoLongitude,
  enderecoTextoEncontrado,
  enderecoConfirmado,
}: {
  defaultValues: Partial<EnderecoValores>;
  geocodificado: boolean;
  enderecoLatitude?: number | null;
  enderecoLongitude?: number | null;
  enderecoTextoEncontrado?: string | null;
  enderecoConfirmado?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  // Coordenada mostrada no mapa — vem do endereço já salvo (se geocodificado)
  // e é atualizada sempre que o endereço é regeocodificado ou o pino é
  // arrastado/clicado. Ficar `null` só quando nunca houve geocodificação (e
  // nenhum centro aproximado disponível).
  const [coords, setCoords] = useState<Coords | null>(
    geocodificado && enderecoLatitude != null && enderecoLongitude != null
      ? { latitude: enderecoLatitude, longitude: enderecoLongitude }
      : null
  );
  const [pinAproximado, setPinAproximado] = useState(false);
  const [textoEncontrado, setTextoEncontrado] = useState<string | null>(enderecoTextoEncontrado ?? null);
  const [confirmado, setConfirmado] = useState(Boolean(enderecoConfirmado));
  const [salvandoPin, setSalvandoPin] = useState(false);

  const handlePinChange = useCallback((lat: number, lng: number) => {
    setCoords({ latitude: lat, longitude: lng });
    setPinAproximado(false);
    setConfirmado(false);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setIssues({});
    setAviso(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      cep: form.get("cep"),
      logradouro: form.get("logradouro"),
      numero: form.get("numero"),
      complemento: form.get("complemento"),
      bairro: form.get("bairro"),
      cidade: form.get("cidade"),
      estado: form.get("estado"),
    };

    const result = await apiPatchJson<SalvarResposta>("/api/responsavel/endereco", payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    // Todo (re)geocode reseta a confirmação — é um pino novo, ninguém olhou
    // ele ainda.
    setConfirmado(false);

    if (result.data.geocodificado) {
      setCoords({ latitude: result.data.enderecoLatitude!, longitude: result.data.enderecoLongitude! });
      setTextoEncontrado(result.data.enderecoTextoEncontrado);
      setPinAproximado(false);
      setAviso(
        "Endereço salvo. Confira o pino e o texto encontrado abaixo — se não for exatamente a sua casa, arraste o pino (ou toque no lugar certo) e confirme."
      );
    } else if (result.data.centroAproximado) {
      setCoords(result.data.centroAproximado);
      setTextoEncontrado(null);
      setPinAproximado(true);
      setAviso(
        "Não conseguimos localizar esse endereço automaticamente. Posicione o pino manualmente no mapa abaixo (ele começa só no centro aproximado da cidade) e confirme."
      );
    } else {
      setCoords(null);
      setTextoEncontrado(null);
      setAviso(
        "Endereço salvo, mas não conseguimos localizá-lo no mapa automaticamente. Confira se está correto — sem isso, esse endereço não entra na rota do motorista."
      );
    }

    router.refresh();
  }

  async function handleConfirmarPin() {
    if (!coords) return;
    setSalvandoPin(true);
    setFormError(null);

    const result = await apiPatchJson<{ ok: true }>("/api/responsavel/endereco/coordenadas", coords);
    setSalvandoPin(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setPinAproximado(false);
    setTextoEncontrado(null);
    setConfirmado(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {!geocodificado && !aviso && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Ainda não conseguimos localizar este endereço no mapa. Confira os dados e salve novamente.
          </p>
        )}

        {geocodificado && !confirmado && !aviso && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Este endereço ainda não foi confirmado no mapa — confira o pino abaixo e clique em &quot;Confirmar
            localização&quot;. Enquanto isso, o motorista pode receber uma rota imprecisa.
          </p>
        )}

        <EnderecoFields defaultValues={defaultValues} issues={issues} />

        {aviso && <p className="text-sm text-amber-700 dark:text-amber-400">{aviso}</p>}
        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Salvando…" : "Salvar endereço"}
        </button>
      </form>

      {coords && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Confirme a localização</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {pinAproximado
                ? "Mapa centralizado só na cidade — toque no ponto certo do mapa (ou arraste o pino) e confirme."
                : "Se o pino não estiver na sua casa, arraste-o (ou toque no ponto certo do mapa) e clique em “Confirmar localização”."}
            </p>
            {textoEncontrado && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Endereço encontrado pelo sistema: <span className="italic">{textoEncontrado}</span>
              </p>
            )}
          </div>

          <div className="h-64 w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
            <PinPicker latitude={coords.latitude} longitude={coords.longitude} onChange={handlePinChange} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConfirmarPin}
              disabled={salvandoPin || confirmado}
              className={secondaryButtonClass + " w-auto px-4"}
            >
              {salvandoPin ? "Salvando…" : confirmado ? "Localização confirmada" : "Confirmar localização"}
            </button>
            {confirmado && <span className="text-sm text-green-600 dark:text-green-400">✓ Confirmado</span>}
          </div>
        </div>
      )}
    </div>
  );
}
