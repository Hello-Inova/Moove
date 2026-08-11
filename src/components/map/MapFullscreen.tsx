"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

function ExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M7.5 2.5h-5v5M12.5 2.5h5v5M7.5 17.5h-5v-5M12.5 17.5h5v-5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 7.5h5v-5M17.5 7.5h-5v-5M2.5 12.5h5v5M17.5 12.5h-5v5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Deve ficar dentro do `<MapContainer>`. O Leaflet calcula o tamanho dos
 * tiles a partir do tamanho do elemento na hora em que é montado, e não
 * percebe sozinho quando esse tamanho muda por causa de uma classe CSS
 * (só reage a eventos de resize da janela) — sem isso, ao entrar/sair da
 * tela cheia o mapa fica com metade dos tiles faltando até o usuário
 * arrastar ou dar zoom manualmente. `requestAnimationFrame` dá tempo do
 * navegador aplicar o novo layout (position: fixed) antes de perguntar o
 * tamanho pro Leaflet.
 */
export function InvalidateOnResize({ watch }: { watch: unknown }) {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [watch, map]);
  return null;
}

/**
 * Botão "expandir para tela cheia" — canto superior direito, pra não
 * disputar espaço com o botão de "seguir localização" (FollowControl, no
 * canto inferior direito). Fica por cima de qualquer conteúdo da página em
 * modo expandido (z-index alto, mas abaixo do diálogo de confirmação de
 * encerrar compartilhamento — ver StopSharingDialog.tsx).
 */
export function FullscreenButton({ expandido, onToggle }: { expandido: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={expandido}
      aria-label={expandido ? "Sair da tela cheia" : "Expandir mapa para tela cheia"}
      className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-md transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
      style={{ zIndex: 1000 }}
    >
      {expandido ? <CollapseIcon /> : <ExpandIcon />}
    </button>
  );
}

/** Fecha o modo tela cheia com a tecla Esc — comportamento padrão de
 * qualquer fullscreen na web. */
export function useFecharComEsc(expandido: boolean, onFechar: () => void) {
  useEffect(() => {
    if (!expandido) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expandido, onFechar]);
}
