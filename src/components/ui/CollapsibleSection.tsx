"use client";

import { useState, type ReactNode } from "react";

/** Seta simples que gira 180° quando expandido — evita depender de um
 * pacote de ícones só para isso. */
function ChevronIcon({ aberto }: { aberto: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
    >
      <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Seção com cabeçalho clicável que minimiza/expande o conteúdo — usado no
 * "Cadastrar nova escola" (e reaproveitável em qualquer outro formulário
 * que precise do mesmo comportamento).
 */
export function CollapsibleSection({
  title,
  children,
  defaultAberto = false,
}: {
  title: string;
  children: ReactNode;
  defaultAberto?: boolean;
}) {
  const [aberto, setAberto] = useState(defaultAberto);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:bg-neutral-900 dark:border-neutral-700">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <h2 className="font-medium">{title}</h2>
        <ChevronIcon aberto={aberto} />
      </button>
      {aberto && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}
