"use client";

import { useLocationSharing } from "@/hooks/useLocationSharing";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";

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

export function LocationSharingPanel() {
  const { status, error, lastSentAt, start, stop } = useLocationSharing();
  const isActive = status === "ativando" || status === "compartilhando";

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
          <p className="font-medium">{STATUS_LABEL[status]}</p>
        </div>
        {isActive ? (
          <button onClick={stop} className={secondaryButtonClass}>
            Parar
          </button>
        ) : (
          <button onClick={start} className={primaryButtonClass + " w-auto px-6"}>
            Iniciar rota
          </button>
        )}
      </div>

      {lastSentAt && (
        <p className="mt-2 text-xs text-neutral-500">
          Última atualização enviada às {lastSentAt.toLocaleTimeString("pt-BR")}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <p className="mt-4 text-sm text-neutral-500">
        Você precisa habilitar o compartilhamento a cada nova sessão. Mantenha esta aba
        aberta e a tela do celular ligada durante a rota — navegadores mobile (principalmente
        iOS/Safari) podem pausar o envio de localização se a aba for minimizada ou o
        aparelho bloquear a tela.
      </p>
    </section>
  );
}
