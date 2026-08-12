"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPatchJson, apiPostJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { EnderecoFields, type EnderecoValores } from "@/components/ui/EnderecoFields";
import { PinPicker } from "@/components/map/PinPicker";

export type EscolaEditavel = {
  id: string;
  nome: string;
  enderecoLatitude?: number | null;
  enderecoLongitude?: number | null;
  enderecoTextoEncontrado?: string | null;
  enderecoConfirmado?: boolean;
  enderecoPrecisaoBaixa?: boolean;
  geocodificada?: boolean;
} & Partial<EnderecoValores>;

type Coords = { latitude: number; longitude: number };

type SalvarResposta = {
  id?: string;
  geocodificada: boolean;
  enderecoLatitude: number | null;
  enderecoLongitude: number | null;
  enderecoTextoEncontrado: string | null;
  enderecoPrecisaoBaixa: boolean;
  centroAproximado: Coords | null;
};

/**
 * Formulário de escola — serve tanto pra cadastrar (sem `escola`) quanto
 * editar (`escola` com os valores atuais pré-preenchidos). Em modo edição,
 * `onCancel` fecha o formulário sem salvar.
 *
 * Inclui o mesmo ajuste manual de pino que o responsável já tem em "Meu
 * endereço" (ver EnderecoForm.tsx) — a geocodificação automática acerta a
 * rua/CEP mas erra o ponto exato com alguma frequência, principalmente em
 * loteamentos e condomínios fechados mal mapeados no OpenStreetMap. Sem essa
 * confirmação visual, um endereço "geocodificado com sucesso" pode estar
 * apontando pro lugar errado sem ninguém perceber até o motorista já estar
 * na rota.
 */
export function EscolaForm({ escola, onSaved, onCancel }: { escola?: EscolaEditavel; onSaved?: () => void; onCancel?: () => void }) {
  const router = useRouter();
  const editando = Boolean(escola);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});

  const [escolaId, setEscolaId] = useState<string | undefined>(escola?.id);
  const [coords, setCoords] = useState<Coords | null>(
    escola?.geocodificada && escola.enderecoLatitude != null && escola.enderecoLongitude != null
      ? { latitude: escola.enderecoLatitude, longitude: escola.enderecoLongitude }
      : null
  );
  // true quando o pino não veio de geocodificação real, só de um centro
  // aproximado (cidade/UF) pra ter algum mapa pra posicionar manualmente.
  const [pinAproximado, setPinAproximado] = useState(false);
  const [textoEncontrado, setTextoEncontrado] = useState<string | null>(escola?.enderecoTextoEncontrado ?? null);
  const [confirmado, setConfirmado] = useState(Boolean(escola?.enderecoConfirmado));
  const [precisaoBaixa, setPrecisaoBaixa] = useState(Boolean(escola?.enderecoPrecisaoBaixa));
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
    setWarning(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const payload = {
      nome: form.get("nome"),
      cep: form.get("cep"),
      logradouro: form.get("logradouro"),
      numero: form.get("numero"),
      complemento: form.get("complemento"),
      bairro: form.get("bairro"),
      cidade: form.get("cidade"),
      estado: form.get("estado"),
    };

    const result = editando
      ? await apiPatchJson<SalvarResposta>(`/api/motorista/escolas/${escola!.id}`, payload)
      : await apiPostJson<SalvarResposta>("/api/motorista/escolas", payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    if (result.data.id) setEscolaId(result.data.id);

    // Todo (re)geocode reseta a confirmação — é um pino novo, ninguém olhou
    // ele ainda.
    setConfirmado(false);
    setPrecisaoBaixa(result.data.enderecoPrecisaoBaixa);

    if (result.data.geocodificada) {
      setCoords({ latitude: result.data.enderecoLatitude!, longitude: result.data.enderecoLongitude! });
      setTextoEncontrado(result.data.enderecoTextoEncontrado);
      setPinAproximado(false);
      setWarning(
        result.data.enderecoPrecisaoBaixa
          ? "Escola salva, mas essa coordenada é aproximada (não veio da rua exata) — o pino pode estar em outro lugar da região. Confira com atenção e ajuste antes de confirmar."
          : "Escola salva. Confira o pino e o texto encontrado abaixo — se não for exatamente o endereço certo, arraste o pino (ou toque no lugar certo) e confirme."
      );
    } else if (result.data.centroAproximado) {
      setCoords(result.data.centroAproximado);
      setTextoEncontrado(null);
      setPinAproximado(true);
      setWarning(
        "Não conseguimos localizar esse endereço automaticamente — comum em condomínios/loteamentos fechados recém-criados. Posicione o pino manualmente no mapa abaixo (ele começa só no centro aproximado da cidade) e confirme."
      );
    } else {
      setCoords(null);
      setTextoEncontrado(null);
      setWarning(
        "Escola salva, mas não conseguimos localizá-la no mapa automaticamente. Confira o endereço — sem isso, a rota até essa escola não funciona."
      );
    }

    if (!editando) event.currentTarget.reset();
    router.refresh();
    onSaved?.();
  }

  async function handleConfirmarPin() {
    if (!coords || !escolaId) return;
    setSalvandoPin(true);
    setFormError(null);

    const result = await apiPatchJson<{ ok: true }>(`/api/motorista/escolas/${escolaId}/coordenadas`, coords);
    setSalvandoPin(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setPinAproximado(false);
    setTextoEncontrado(null);
    setConfirmado(true);
    setPrecisaoBaixa(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="nome">
            Nome da escola
          </label>
          <input id="nome" name="nome" required defaultValue={escola?.nome} className={inputClass} />
          <FieldError message={issues.nome?.[0]} />
        </div>

        {escola?.geocodificada && !confirmado && !warning && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {precisaoBaixa
              ? "Essa localização é aproximada (não veio da rua exata) — confira o pino com atenção, ele pode estar em outro lugar da região, e clique em “Confirmar localização” depois de ajustar."
              : "Este endereço ainda não foi confirmado no mapa — confira o pino abaixo e clique em “Confirmar localização”. Enquanto isso, a rota até essa escola pode estar imprecisa."}
          </p>
        )}

        <EnderecoFields
          issues={issues}
          defaultValues={
            escola
              ? {
                  cep: escola.cep ?? "",
                  logradouro: escola.logradouro ?? "",
                  numero: escola.numero ?? "",
                  complemento: escola.complemento ?? "",
                  bairro: escola.bairro ?? "",
                  cidade: escola.cidade ?? "",
                  estado: escola.estado ?? "",
                }
              : undefined
          }
        />

        {formError && <p className="text-sm text-red-600">{formError}</p>}
        {warning && <p className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={loading} className={primaryButtonClass + " w-auto px-4"}>
            {loading ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar escola"}
          </button>
          {editando && (
            <button type="button" onClick={onCancel} className={secondaryButtonClass + " w-auto px-4"}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {coords && escolaId && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Confirme a localização</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {pinAproximado
                ? "Mapa centralizado só na cidade — toque no ponto certo do mapa (ou arraste o pino) e confirme."
                : "Se o pino não estiver no lugar certo, arraste-o (ou toque no ponto certo do mapa) e confirme."}
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
