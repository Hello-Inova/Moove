"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { VerifyCodeForm } from "@/components/auth/VerifyCodeForm";

type Role = "motorista" | "responsavel";
type LoginResult = { email: string; role: Role };

const homeByRole: Record<Role, string> = {
  motorista: "/motorista/painel",
  responsavel: "/responsavel/dashboard",
};

export function UnifiedLoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingLogin, setPendingLogin] = useState<LoginResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const result = await apiPostJson<LoginResult>("/api/auth/login", {
      email: form.get("email"),
      senha: form.get("senha"),
    });
    setLoading(false);
    if (!result.ok) return setFormError(result.error);
    setPendingLogin(result.data);
  }

  if (pendingLogin) {
    return (
      <div className="space-y-4">
        <VerifyCodeForm
          role={pendingLogin.role}
          email={pendingLogin.email}
          proposito="LOGIN"
          verifyUrl={`/api/auth/${pendingLogin.role}/login/verificar`}
          onVerified={() => {
            router.push(homeByRole[pendingLogin.role]);
            router.refresh();
          }}
        />
        <button
          type="button"
          onClick={() => setPendingLogin(null)}
          className="w-full text-center text-sm text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" required className={inputClass} autoComplete="email" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="senha">
          Senha
        </label>
        <PasswordInput id="senha" name="senha" required className={inputClass} autoComplete="current-password" />
      </div>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Identificando acesso…" : "Entrar"}
      </button>
      <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
        Esqueceu a senha? Escolha seu perfil: {" "}
        <Link href="/motorista/recuperar-senha" className="underline">
          motorista
        </Link>{" "}
        ou {" "}
        <Link href="/responsavel/recuperar-senha" className="underline">
          responsável
        </Link>.
      </p>
    </form>
  );
}
