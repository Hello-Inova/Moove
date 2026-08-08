"use client";

import { useState, type FormEvent } from "react";

import { apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";

type Role = "motorista" | "responsavel";
type Proposito = "CADASTRO" | "LOGIN";

export function VerifyCodeForm<T>({
  role,
  email,
  proposito,
  verifyUrl,
  onVerified,
}: {
  role: Role;
  email: string;
  proposito: Proposito;
  verifyUrl: string;
  onVerified: (data: T) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await apiPostJson<T>(verifyUrl, { email, codigo });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onVerified(result.data);
  }

  async function handleResend() {
    setResending(true);
    setResendMessage(null);
    setError(null);

    const result = await apiPostJson(`/api/auth/${role}/reenviar-codigo`, { email, proposito });
    setResending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResendMessage("Novo código enviado — confira seu e-mail.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-neutral-600">
        Enviamos um código de 6 dígitos para <strong>{email}</strong>. Ele expira em 10 minutos.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="codigo">
          Código de verificação
        </label>
        <input
          id="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className={inputClass + " text-center text-2xl tracking-[0.5em]"}
          autoFocus
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {resendMessage && <p className="text-sm text-green-700">{resendMessage}</p>}

      <button type="submit" disabled={loading || codigo.length !== 6} className={primaryButtonClass}>
        {loading ? "Confirmando…" : "Confirmar código"}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="w-full text-center text-sm text-neutral-500 underline underline-offset-2 disabled:opacity-50"
      >
        {resending ? "Reenviando…" : "Reenviar código"}
      </button>
    </form>
  );
}
