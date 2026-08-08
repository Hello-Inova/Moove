"use client";

import { useState } from "react";

export function CopyCodeButton({ codigo }: { codigo: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (ex: contexto não seguro) — sem tratamento especial
    }
  }

  return (
    <button
      onClick={handleClick}
      className="rounded-md bg-neutral-100 px-2 py-1 font-mono text-sm tracking-wider hover:bg-neutral-200 dark:bg-neutral-800"
      title="Copiar código"
    >
      {copied ? "Copiado!" : codigo}
    </button>
  );
}
