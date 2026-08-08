"use client";

import { Logo } from "@/components/ui/Logo";
import { secondaryButtonClass } from "@/components/ui/form-elements";

export function StopSharingDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="stop-sharing-title"
      aria-describedby="stop-sharing-description"
    >
      <div className="stop-sharing-alert w-full max-w-sm rounded-2xl bg-white p-6 text-center dark:bg-neutral-900">
        <Logo height={22} className="mx-auto" />

        <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 9v4m0 4h.01M10.29 3.86 2.11 18.04A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-2.96L13.71 3.86a2 2 0 0 0-3.42 0Z"
              stroke="#dc2626"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2 id="stop-sharing-title" className="mt-3 text-lg font-semibold text-brand-navy">
          Encerrar o compartilhamento da rota?
        </h2>
        <p id="stop-sharing-description" className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          Essa ação vai interromper o envio da sua localização em tempo real agora mesmo. Os
          responsáveis vinculados deixarão de ver onde você está até você iniciar a rota novamente.
        </p>

        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className={secondaryButtonClass + " flex-1"}>
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-red-700 active:scale-[0.99]"
          >
            Encerrar
          </button>
        </div>
      </div>
    </div>
  );
}
