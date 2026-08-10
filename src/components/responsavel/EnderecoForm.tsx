"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPatchJson } from "@/lib/api-client";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { EnderecoFields, type EnderecoValores } from "@/components/ui/EnderecoFields";
import { PinPicker } from "@/components/map/PinPicker";

type Coords = { latitude: number; longitude: number };

export function EnderecoForm({
  defaultValues,
  geocodificado,
  enderecoLatitude,
  enderecoLongitude,
}: {
  defaultValues: Partial<EnderecoValores>;
  geocodificado: boolean;
  enderecoLatitude?: number | null;
  enderecoLongitude?: number | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  // Coordenada mostrada no mapa — vem do endereço já salvo (se geocodificado)
  // e é atualizada sempre que o endereço é regeocodificado ou o pino é
  // arrastado/clicado. Ficar `null` só quando nunca houve geocodificação.
  const [coords, setCoords] = useState<Coords | null>(
    geocodificado && enderecoLatitude != null && enderecoLongitude != null
      ? { latitude: enderecoLatitude, longitude: enderecoLongitude }
      : null
  );
  const [pinAlterado, setPinAlterado] = useState(false);
  const [salvandoPin, setSalvandoPin] = useState(false);
  const [pinSalvo, setPinSalvo] = useState(false);

  const handlePinChange = useCallback((lat: number, lng: number) => {
    setCoords({ latitude: lat, longitude: lng });
    setPinAlterado(true);
    setPinSalvo(false);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setIssues({});
    setAviso(null);
    setPinAlterado(false);
    setPinSalvo(false);

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

    const result = await apiPatchJson<{
      ok: true;
      geocodificado: boolean;
      enderecoLatitude: number | null;
      enderecoLongitude: number | null;
    }>("/api/responsavel/endereco", payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    if (!result.data.geocodificado) {
      setCoords(null);
      setAviso(
        "Endereço salvo, mas não conseguimos localizá-lo no mapa automaticamente. Confira se está correto — sem isso, esse endereço não entra na rota do motorista."
      );
    } else {
      setCoords({
        latitude: result.data.enderecoLatitude!,
        longitude: result.data.enderecoLongitude!,
      });
      setAviso(
        "Endereço salvo. Confira o pino no mapa abaixo — se ele não estiver exatamente na sua casa, arraste (ou toque no lugar certo) e confirme."
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

    setPinAlterado(false);
    setPinSalvo(true);
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
              Se o pino não estiver na sua casa, arraste-o (ou toque no ponto certo do mapa) e clique em
              &quot;Confirmar localização&quot;.
            </p>
          </div>

          <div className="h-64 w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
            <PinPicker latitude={coords.latitude} longitude={coords.longitude} onChange={handlePinChange} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConfirmarPin}
              disabled={salvandoPin || !pinAlterado}
              className={secondaryButtonClass + " w-auto px-4"}
            >
              {salvandoPin ? "Salvando…" : "Confirmar localização"}
            </button>
            {pinSalvo && <span className="text-sm text-green-600 dark:text-green-400">Localização confirmada.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
