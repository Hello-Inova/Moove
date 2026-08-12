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

function formatarCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function RegisterForm({ role }: { role: Role }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [aceitaLgpd, setAceitaLgpd] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");

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
      cpf,
      senha,
      confirmarSenha,
      aceitaLgpd,
    };

    if (role === "responsavel" || role === "motorista") {
      payload.cep = form.get("cep");
      payload.logradouro = form.get("logradouro");
      payload.numero = form.get("numero");
      payload.complemento = form.get("complemento");
      payload.bairro = form.get("bairro");
      payload.cidade = form.get("cidade");
      payload.estado = form.get("estado");
    }

    if (role === "motorista") {
      payload.nomeEscola = form.get("nomeEscola");
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
            // Leva direto pra tela de confirmar o pino no mapa (em vez do
            // painel geral) — a geocodificação automática do endereço
            // digitado no cadastro pode ter errado o ponto exato, e é bem
            // mais fácil corrigir isso agora do que descobrir só quando o
            // motorista já estiver na rota. Quem não tem endereço/escola
            // pra confirmar (não aplicável hoje, os dois roles sempre têm)
            // só veria a tela vazia normalmente.
            const destino = role === "motorista" ? "/motorista/escolas" : "/responsavel/endereco";
            router.push(`${destino}?novo=1`);
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
        <label className="mb-1 block text-sm font-medium" htmlFor="cpf">
          CPF
        </label>
        <input
          id="cpf"
          name="cpf"
          required
          inputMode="numeric"
          placeholder="000.000.000-00"
          maxLength={14}
          value={cpf}
          onChange={(e) => setCpf(formatarCpf(e.target.value))}
          className={inputClass}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Usado só para evitar cadastro duplicado — não é compartilhado com outros usuários.
        </p>
        <FieldError message={issues.cpf?.[0]} />
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

      {role === "motorista" && (
        <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <p className="mb-3 text-sm font-medium">Escola que você atende</p>
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            Você pode cadastrar mais escolas depois, em &quot;Minhas escolas&quot;.
          </p>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium" htmlFor="nomeEscola">
              Nome da escola
            </label>
            <input id="nomeEscola" name="nomeEscola" required className={inputClass} />
            <FieldError message={issues.nomeEscola?.[0]} />
          </div>
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
