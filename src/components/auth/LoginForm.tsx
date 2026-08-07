"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";

type Role = "motorista" | "responsavel";

export function LoginForm({ role }: { role: Role }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const payload = { email: form.get("email"), senha: form.get("senha") };

    const result = await apiPostJson(`/api/auth/${role}/login`, payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    router.push(`/${role}/dashboard`);
    router.refresh();
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
        <input
          id="senha"
          name="senha"
          type="password"
          required
          className={inputClass}
          autoComplete="current-password"
        />
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
