"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";

/**
 * Providers globais montados uma vez, no layout raiz — ConfirmProvider
 * (troca window.confirm por um modal no estilo do app) e o Toaster do
 * sonner (troca window.alert / mensagens de sucesso silenciosas por toasts).
 */
export function Providers({ children }: { children: ReactNode }) {
  // O tema (claro/escuro) é controlado à mão via classe `.dark` na <html>
  // (ver ThemeToggle.tsx) — não usamos next-themes, então observamos a
  // classe pra manter o Toaster combinando com o resto da tela.
  const [tema, setTema] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const atualizar = () => setTema(root.classList.contains("dark") ? "dark" : "light");
    atualizar();

    const observer = new MutationObserver(atualizar);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ConfirmProvider>
      {children}
      <Toaster richColors position="top-center" theme={tema} closeButton />
    </ConfirmProvider>
  );
}
