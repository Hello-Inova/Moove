"use client";

import { useEffect, useState } from "react";

import { useLocationSharingContext } from "@/contexts/LocationSharingContext";
import { apiGet, apiPatchJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";

const STATUS_LABEL: Record<string, string> = {
  parado: "Localização desligada",
  ativando: "Ativando GPS…",
  compartilhando: "Compartilhando localização",
  erro: "Erro ao compartilhar localização",
};

const STATUS_DOT: Record<string, string> = {
  parado: "bg-neutral-400",
  ativando: "bg-amber-500 animate-pulse",
  compartilhando: "bg-green-500",
  erro: "bg-red-500",
};

function AlertaChegadaConfig() {
  const [minutos, setMinutos] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    apiGet<{ alertaChegadaMinutos: number }>("/api/motorista/alerta-chegada").then((result) => {
      if (result.ok) setMinutos(result.data.alertaChegadaMinutos);
    });
  }, []);

  async function salvar() {
    if (minutos === null) return;
    setSalvando(true);
    setSalvo(false);
    const result = await apiPatchJson("/api/motorista/alerta-chegada", { alertaChegadaMinutos: minutos });
    setSalvando(false);
    if (result.ok) setSalvo(true);
  }

  if (minutos === null) return null;

  return (
    <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
      <p className="text-sm font-medium">Alerta sonoro de chegada</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Avisa o responsável (com som) quando você estiver a aproximadamente esses minutos do endereço dele.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          max={30}
          value={minutos}
          onChange={(e) => {
            setMinutos(Number(e.target.value));
            setSalvo(false);
          }}
          className={inputClass + " w-20"}
        />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">minutos</span>
        <button onClick={salvar} disabled={salvando} className={secondaryButtonClass + " w-auto px-4 py-1.5 text-sm"}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        {salvo && <span className="text-sm text-green-600 dark:text-green-400">Salvo.</span>}
      </div>
    </div>
  );
}

export function LocationSharingPanel() {
  const { status, error, lastSentAt, start, isSharing, confirmAndRun } = useLocationSharingContext();

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
          <p className="font-medium">{STATUS_LABEL[status]}</p>
        </div>
        {isSharing ? (
          <button onClick={() => confirmAndRun(() => {})} className={secondaryButtonClass}>
            Parar
          </button>
        ) : (
          <button onClick={start} className={primaryButtonClass + " w-auto px-6"}>
            Iniciar rota
          </button>
        )}
      </div>

      {lastSentAt && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Última atualização enviada às {lastSentAt.toLocaleTimeString("pt-BR")}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div
        className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
          isSharing
            ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            : "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
          <path
            d="M10 2.5l8 14.5H2l8-14.5z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M10 8v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="10" cy="14" r="0.9" fill="currentColor" />
        </svg>
        <p>
          <strong>Mantenha o Moove aberto</strong> na tela enquanto compartilha — se você fechar o
          app/navegador, o compartilhamento e o rastreio são interrompidos na hora. Navegar entre as
          páginas do Moove (Vínculos, Convites, Escolas etc.) não interrompe o envio. Só evite trocar
          para outro aplicativo ou bloquear a tela do celular: navegadores mobile (principalmente
          iOS/Safari) pausam o GPS nesses casos — é uma limitação do próprio celular/navegador, não do
          Moove.
        </p>
      </div>

      <AlertaChegadaConfig />
    </section>
  );
}
