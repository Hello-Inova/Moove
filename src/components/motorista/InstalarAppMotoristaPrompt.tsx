"use client";

import { Download, Share, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type Plataforma = "android" | "ios" | "outra";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function plataformaAtual(): Plataforma {
  const userAgent = navigator.userAgent;
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "outra";
}

function appEstaInstalado() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

/**
 * Mantém a sugestão de instalação visível em celulares até que o Moove seja
 * aberto como aplicativo instalado. O Android usa o diálogo nativo quando o
 * navegador o disponibiliza; no iOS mostramos o caminho exigido pelo Safari.
 */
export function InstalarAppMotoristaPrompt() {
  const [plataforma, setPlataforma] = useState<Plataforma>("outra");
  const [instalado, setInstalado] = useState(true);
  const [eventoInstalacao, setEventoInstalacao] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const modoStandalone = window.matchMedia("(display-mode: standalone)");
    const atualizarInstalacao = () => setInstalado(appEstaInstalado());
    const guardarPrompt = (event: Event) => {
      event.preventDefault();
      setEventoInstalacao(event as BeforeInstallPromptEvent);
    };
    const concluirInstalacao = () => {
      setInstalado(true);
      setEventoInstalacao(null);
    };

    setPlataforma(plataformaAtual());
    atualizarInstalacao();
    window.addEventListener("beforeinstallprompt", guardarPrompt);
    window.addEventListener("appinstalled", concluirInstalacao);
    modoStandalone.addEventListener("change", atualizarInstalacao);

    return () => {
      window.removeEventListener("beforeinstallprompt", guardarPrompt);
      window.removeEventListener("appinstalled", concluirInstalacao);
      modoStandalone.removeEventListener("change", atualizarInstalacao);
    };
  }, []);

  async function instalarNoAndroid() {
    if (!eventoInstalacao) return;
    await eventoInstalacao.prompt();
    const escolha = await eventoInstalacao.userChoice;
    if (escolha.outcome === "accepted") setInstalado(true);
    setEventoInstalacao(null);
  }

  if (instalado || plataforma === "outra") return null;

  const androidComPrompt = plataforma === "android" && eventoInstalacao !== null;

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[205] mx-auto max-w-md rounded-2xl border border-brand-orange/30 bg-white p-4 shadow-2xl dark:bg-neutral-900"
      aria-label="Instalar aplicativo Moove"
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange-dark dark:bg-brand-orange/15 dark:text-brand-orange-light">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-900 dark:text-white">Instale o Moove no celular</h2>
          {plataforma === "ios" ? (
            <p className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
              Para usar como aplicativo, toque em <Share className="mx-0.5 inline h-4 w-4" aria-label="Compartilhar" /> <strong>Compartilhar</strong> no Safari e escolha <strong>Adicionar à Tela de Início</strong>.
            </p>
          ) : androidComPrompt ? (
            <p className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
              Instale para abrir mais rápido, manter a rota ativa e receber avisos no seu aparelho.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
              No menu do navegador, toque em <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
            </p>
          )}
        </div>
      </div>

      {androidComPrompt && (
        <button
          type="button"
          onClick={() => void instalarNoAndroid()}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-navy-light"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Instalar aplicativo
        </button>
      )}
    </aside>
  );
}
