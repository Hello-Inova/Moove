"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiPostJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass } from "@/components/ui/form-elements";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { EnderecoFields } from "@/components/ui/EnderecoFields";
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
    setFormError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const senha = String(form.get("senha") ?? "");
    const confirmarSenha = String(form.get("confirmarSenha") ?? "");

    if (senha !== confirmarSenha) {
      setIssues({ confirmarSenha: ["As senhas não coincidem."] });
      return;
    }

    setLoading(true);

    const payload: Record<string, unknown> = {
      nome: form.get("nome"),
      email: form.get("email"),
      telefone: form.get("telefone"),
      senha,
      confirmarSenha,
      aceitaLgpd,
    };

    if (role === "responsavel") {
      payload.cep = form.get("cep");
      payload.logradouro = form.get("logradouro");
      payload.numero = form.get("numero");
      payload.complemento = form.get("complemento");
      payload.bairro = form.get("bairro");
      payload.cidade = form.get("cidade");
      payload.estado = form.get("estado");
    }

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
          className="w-full text-center text-sm text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
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
        <PasswordInput id="senha" name="senha" required minLength={8} className={inputClass} autoComplete="new-password" />
        <FieldError message={issues.senha?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="confirmarSenha">
          Repetir senha
        </label>
        <PasswordInput
          id="confirmarSenha"
          name="confirmarSenha"
          required
          minLength={8}
          className={inputClass}
          autoComplete="new-password"
        />
        <FieldError message={issues.confirmarSenha?.[0]} />
      </div>

      {role === "responsavel" && (
        <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <p className="mb-3 text-sm font-medium">Endereço do aluno (embarque/desembarque)</p>
          <EnderecoFields issues={issues} />
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
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
