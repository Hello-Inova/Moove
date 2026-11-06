"use client";

import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const GUIDE_URL = "/guias/guia-de-uso-do-motorista-moove.pdf";

function storageKey(motoristaId: string) {
  return `moove:guia-motorista:nao-exibir:${motoristaId}`;
}

/**
 * Exibe o guia a cada entrada ou troca de aba até o motorista optar por não
 * receber mais a sugestão. A preferência é individual e fica no navegador.
 */
export function GuiaMotoristaDownloadPrompt({ motoristaId }: { motoristaId: string }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [naoExibir, setNaoExibir] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey(motoristaId))) {
        setNaoExibir(false);
        setAberto(true);
      }
    } catch {
      // Em navegação privada, mantém a sugestão ativa nesta sessão.
      setNaoExibir(false);
      setAberto(true);
    }
  }, [motoristaId, pathname]);

  function salvarPreferencia() {
    if (naoExibir) {
      try {
        localStorage.setItem(storageKey(motoristaId), "true");
      } catch {
        // A opção continua válida até a próxima navegação caso o navegador
        // não permita persistência local.
      }
    }
    setAberto(false);
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="guia-motorista-titulo">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-orange-soft text-brand-orange-dark dark:bg-brand-orange/15 dark:text-brand-orange-light">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="guia-motorista-titulo" className="text-lg font-semibold text-neutral-900 dark:text-white">
              Guia de uso do motorista
            </h2>
            <p className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
              Baixe o guia com as abas, formulários e funções do Moove para consultar quando precisar.
            </p>
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
          <input
            type="checkbox"
            checked={naoExibir}
            onChange={(event) => setNaoExibir(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-brand-orange focus:ring-brand-orange"
          />
          Não exibir novamente
        </label>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={salvarPreferencia}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Salvar
          </button>
          <a
            href={GUIDE_URL}
            download="Guia de Uso do Motorista Moove.pdf"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-navy-light"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar guia em PDF
          </a>
        </div>
      </div>
    </div>
  );
}
