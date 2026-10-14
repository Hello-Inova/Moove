"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "moove-cookie-preferences-v1";

export function CookieConsent() {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => setVisivel(!localStorage.getItem(STORAGE_KEY)), []);
  function salvar(opcionais: boolean) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ essenciais: true, opcionais, decididoEm: new Date().toISOString() }));
    setVisivel(false);
  }
  if (!visivel) return null;
  return (
    <aside className="fixed inset-x-3 bottom-3 z-[2000] mx-auto max-w-2xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" role="dialog" aria-label="Preferências de cookies">
      <p className="font-semibold">Sua privacidade importa</p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
        Usamos armazenamento essencial para manter sua sessão e preferências. Cookies opcionais só serão usados se você autorizar. <Link href="/cookies" className="underline">Saiba mais</Link>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => salvar(false)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium">Somente essenciais</button>
        <button onClick={() => salvar(true)} className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white">Aceitar opcionais</button>
      </div>
    </aside>
  );
}
