"use client";

import { useLocationSharingContext } from "@/contexts/LocationSharingContext";
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

      <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
        Você precisa habilitar o compartilhamento a cada nova sessão. Navegar entre as páginas
        do Moove (Vínculos, Convites, Escolas etc.) não interrompe o envio — pode usar o menu
        à vontade durante a rota. Só evite trocar para outro aplicativo ou bloquear a tela do
        celular: navegadores mobile (principalmente iOS/Safari) pausam o GPS nesses casos, o
        que é uma limitação do próprio celular/navegador, não do Moove.
      </p>
    </section>
  );
}
