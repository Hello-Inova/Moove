"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { primaryButtonClass, secondaryButtonClass, dangerButtonClass } from "@/components/ui/form-elements";

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Usa o estilo de perigo (vermelho) no botão de confirmar — ações
   * destrutivas (excluir, revogar, suspender). */
  danger?: boolean;
};

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Substitui `window.confirm` por um modal no estilo do app (funciona em
 * dark mode, não trava a thread do navegador, dá pra estilizar). Uso:
 * `const confirm = useConfirm(); if (!(await confirm("Excluir?"))) return;`
 * — mesmo formato de chamada de antes, só que assíncrono de verdade (o
 * `window.confirm` já era síncrono-bloqueante, então não muda o fluxo de
 * quem chama).
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>.");
  return ctx;
}

type PendingConfirm = { message: string; options: ConfirmOptions; resolve: (value: boolean) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options = {}) => {
    return new Promise<boolean>((resolve) => {
      setPending({ message, options, resolve });
    });
  }, []);

  function responder(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => responder(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            {pending.options.title && <h2 className="mb-1 font-medium">{pending.options.title}</h2>}
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{pending.message}</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button onClick={() => responder(false)} className={secondaryButtonClass + " w-auto px-4"}>
                {pending.options.cancelLabel ?? "Cancelar"}
              </button>
              <button
                onClick={() => responder(true)}
                className={(pending.options.danger ? dangerButtonClass : primaryButtonClass) + " w-auto px-4"}
              >
                {pending.options.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
