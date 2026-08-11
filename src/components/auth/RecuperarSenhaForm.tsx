"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";
import { PasswordInput } from "@/components/ui/PasswordInput";

type Role = "motorista" | "responsavel";

/**
 * Fluxo de recuperação de senha em 2 etapas:
 * 1) informa o e-mail — dispara o código de verificação.
 * 2) informa o código recebido + a nova senha — troca a senha e já loga.
 * O mesmo endpoint de solicitação serve para reenviar o código.
 */
export function RecuperarSenhaForm({ role }: { role: Role }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function solicitarCodigo(emailAlvo: string) {
    const result = await apiPostJson<{ email: string }>(`/api/auth/${role}/recuperar-senha`, {
      email: emailAlvo,
    });
    return result;
  }

  async function handleSolicitar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const emailDigitado = String(form.get("email") ?? "").trim();

    const result = await solicitarCodigo(emailDigitado);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEmail(result.data.email);
    setEtapa("codigo");
  }

  async function handleReenviar() {
    setReenviando(true);
    setError(null);
    setAviso(null);

    const result = await solicitarCodigo(email);
    setReenviando(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAviso("Novo código enviado — confira seu e-mail.");
  }

  async function handleConfirmar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      email,
      codigo: form.get("codigo"),
      novaSenha: form.get("novaSenha"),
      confirmarNovaSenha: form.get("confirmarNovaSenha"),
    };

    const result = await apiPostJson(`/api/auth/${role}/recuperar-senha/confirmar`, payload);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/${role}/dashboard`);
    router.refresh();
  }

  if (etapa === "codigo") {
    return (
      <form onSubmit={handleConfirmar} className="space-y-4" noValidate>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Enviamos um código de 6 dígitos para <strong>{email}</strong>. Digite-o abaixo junto com a sua
          nova senha.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="codigo">
            Código de verificação
          </label>
          <input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="000000"
            className={inputClass + " text-center text-2xl tracking-[0.5em]"}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="novaSenha">
            Nova senha
          </label>
          <PasswordInput id="novaSenha" name="novaSenha" required className={inputClass} autoComplete="new-password" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="confirmarNovaSenha">
            Confirmar nova senha
          </label>
          <PasswordInput
            id="confirmarNovaSenha"
            name="confirmarNovaSenha"
            required
            className={inputClass}
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {aviso && <p className="text-sm text-green-700">{aviso}</p>}

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Salvando…" : "Redefinir senha e entrar"}
        </button>

        <button
          type="button"
          onClick={handleReenviar}
          disabled={reenviando}
          className="w-full text-center text-sm text-neutral-500 underline underline-offset-2 disabled:opacity-50 dark:text-neutral-400"
        >
          {reenviando ? "Reenviando…" : "Reenviar código"}
        </button>

        <button
          type="button"
          onClick={() => {
            setEtapa("email");
            setError(null);
            setAviso(null);
          }}
          className="w-full text-center text-sm text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
        >
          Usar outro e-mail
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSolicitar} className="space-y-4" noValidate>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Informe o e-mail da sua conta. Vamos enviar um código de verificação para você escolher uma nova
        senha.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" required className={inputClass} autoComplete="email" autoFocus />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Enviando…" : "Enviar código"}
      </button>
    </form>
  );
}
