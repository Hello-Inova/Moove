"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { useLocationSharing, type LocationSharingStatus } from "@/hooks/useLocationSharing";
import { StopSharingDialog } from "@/components/motorista/StopSharingDialog";

type LocationSharingContextValue = {
  status: LocationSharingStatus;
  error: string | null;
  lastSentAt: Date | null;
  isSharing: boolean;
  start: () => void;
  /**
   * Executa `action` imediatamente se não houver compartilhamento ativo.
   * Se houver, primeiro mostra o alerta de confirmação — só roda `action`
   * (e encerra o compartilhamento) se o motorista confirmar.
   */
  confirmAndRun: (action: () => void) => void;
};

// Valor padrão "passthrough": fora do MotoristaShell (ex: telas do
// responsável) não há compartilhamento para proteger, então qualquer ação
// roda direto, sem exibir alerta nenhum.
const LocationSharingCtx = createContext<LocationSharingContextValue>({
  status: "parado",
  error: null,
  lastSentAt: null,
  isSharing: false,
  start: () => {},
  confirmAndRun: (action) => action(),
});

export function useLocationSharingContext() {
  return useContext(LocationSharingCtx);
}

export function LocationSharingProvider({ children }: { children: ReactNode }) {
  const { status, error, lastSentAt, start, stop } = useLocationSharing();
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const isSharing = status === "ativando" || status === "compartilhando";

  const confirmAndRun = useCallback(
    (action: () => void) => {
      if (isSharing) {
        setPendingAction(() => action);
      } else {
        action();
      }
    },
    [isSharing]
  );

  // Aviso nativo do navegador ao tentar fechar/recarregar a aba durante o
  // compartilhamento — não dá para customizar esse diálogo, mas ainda avisa.
  useEffect(() => {
    if (!isSharing) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSharing]);

  return (
    <LocationSharingCtx.Provider value={{ status, error, lastSentAt, isSharing, start, confirmAndRun }}>
      {children}
      <StopSharingDialog
        open={pendingAction !== null}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          stop();
          const action = pendingAction;
          setPendingAction(null);
          action?.();
        }}
      />
    </LocationSharingCtx.Provider>
  );
}
