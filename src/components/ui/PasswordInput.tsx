"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

import { inputClass } from "@/components/ui/form-elements";

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 2.5l15 15M8.3 8.4a2.5 2.5 0 0 0 3.4 3.4M6.2 6.2C3.6 7.6 1.5 10 1.5 10s3 6 8.5 6c1.4 0 2.7-.4 3.8-1M15.7 14c1.7-1.4 2.8-3 2.8-3s-3-6-8.5-6c-.6 0-1.2.06-1.7.16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Campo de senha com botão de mostrar/ocultar (padrão em login e cadastro
 * de Motorista, Responsável e Admin). Mantém o mesmo estilo de `inputClass`,
 * só adiciona o toggle sobreposto à direita.
 */
export function PasswordInput({
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visivel, setVisivel] = useState(false);
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="relative">
      <input
        id={inputId}
        type={visivel ? "text" : "password"}
        className={(className ?? inputClass) + " pr-11"}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visivel}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-400 transition hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
      >
        {visivel ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
