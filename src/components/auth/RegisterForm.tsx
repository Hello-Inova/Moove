"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiPostJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass } from "@/components/ui/form-elements";
import { VerifyCodeForm } from "@/components/auth/VerifyCodeForm";

type Role = "motorista" | "responsavel";

const ROLE_LABEL: Record<Role, string> = {
  motorista: "motorista",
  responsavel: "responsável",
};

export function RegisterForm({ role }: { role: Role }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [aceitaLgpd, setAceitaLgpd] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const payload = {
      nome: form.get("nome"),
      email: form.get("email"),
      telefone: form.get("telefone"),
      senha: form.get("senha"),
      aceitaLgpd,
    };

    const result = await apiPostJson<{ email: string }>(`/api/auth/${role}/register`, payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    setPendingEmail(result.data.email);
  }

  if (pendingEmail) {
    return (
      <div className="space-y-4">
        <VerifyCodeForm
          role={role}
          email={pendingEmail}
          proposito="CADASTRO"
          verifyUrl={`/api/auth/${role}/register/verificar`}
          onVerified={() => {
            router.push(`/${role}/dashboard`);
            router.refresh();
          }}
        />
        <button
          type="button"
          onClick={() => setPendingEmail(null)}
          className="w-full text-center text-sm text-neutral-500 underline underline-offset-2"
        >
          Usar outro e-mail
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="nome">
          Nome completo
        </label>
        <input id="nome" name="nome" required className={inputClass} autoComplete="name" />
        <FieldError message={issues.nome?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" required className={inputClass} autoComplete="email" />
        <FieldError message={issues.email?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="telefone">
          Telefone (com DDD)
        </label>
        <input id="telefone" name="telefone" required className={inputClass} autoComplete="tel" />
        <FieldError message={issues.telefone?.[0]} />
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
          minLength={8}
          className={inputClass}
          autoComplete="new-password"
        />
        <FieldError message={issues.senha?.[0]} />
      </div>

      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          className="mt-1"
          checked={aceitaLgpd}
          onChange={(e) => setAceitaLgpd(e.target.checked)}
        />
        <span>
          Li e concordo com o tratamento dos meus dados pessoais e de localização conforme a{" "}
          <Link href="/privacidade" className="underline" target="_blank">
            Política de Privacidade (LGPD)
          </Link>
          .
        </span>
      </label>
      <FieldError message={issues.aceitaLgpd?.[0]} />

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Enviando código…" : `Criar conta de ${ROLE_LABEL[role]}`}
      </button>
    </form>
  );
}
