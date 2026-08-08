"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "moove-theme";

/** Script inline (sem dependências) injetado no <head> em `src/app/layout.tsx`
 * para aplicar a classe `.dark` antes da primeira pintura — evita o "flash"
 * de tema claro em quem prefere escuro. Mantido como string porque roda
 * fora do ciclo de vida do React (precisa executar antes da hidratação). */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.9 4.1l-1.4 1.4M5.5 14.5l-1.4 1.4M15.9 15.9l-1.4-1.4M5.5 5.5 4.1 4.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M17 11.5A7.5 7.5 0 0 1 8.5 3a7.5 7.5 0 1 0 8.5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Botão de alternância de tema, persistido em localStorage. Usado nos
 * headers do motorista/responsável (`AppHeader`), do admin (`AdminShell`)
 * e nas telas de login/cadastro (`AuthCard`). */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !(dark ?? false);
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // localStorage indisponível (modo privado, etc.) — o toggle ainda
      // funciona na sessão atual, só não persiste entre recarregamentos.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      className={
        className ??
        "flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }
    >
      {/* Antes de montar no cliente, não sabemos o tema — evita mismatch de
          hidratação mostrando um ícone neutro (lua) até o useEffect rodar. */}
      {dark === null ? <MoonIcon /> : dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
