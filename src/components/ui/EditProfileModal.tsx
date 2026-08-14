"use client";

import { useEffect, useState, type FormEvent } from "react";

import { apiGet, apiPatchJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { formatarCpf } from "@/lib/validation/cpf";
import { toast } from "sonner";

type Role = "motorista" | "responsavel";

type Perfil = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string | null;
};

/**
 * Modal de "Editar perfil" — aberto a partir do clique no nome do usuário
 * logado na sidebar (ver AppHeader.tsx). Busca os dados atuais em
 * `/api/{role}/me` (GET) e salva via PATCH na mesma rota. E-mail não é
 * editável (mudar exigiria reverificação, fora do escopo).
 */
export function EditProfileModal({
  role,
  onClose,
  onSaved,
}: {
  role: Role;
  onClose: () => void;
  onSaved?: (nome: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [trocarSenha, setTrocarSenha] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const result = await apiGet<Perfil>(`/api/${role}/me`);
      if (!ativo) return;
      if (result.ok) {
        setNome(result.data.nome);
        setEmail(result.data.email);
        setTelefone(result.data.telefone);
        setCpf(result.data.cpf ? formatarCpf(result.data.cpf) : "");
      } else {
        setFormError(result.error);
      }
      setLoading(false);
    })();
    return () => {
      ativo = false;
    };
  }, [role]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      nome: form.get("nome"),
      telefone: form.get("telefone"),
      cpf,
    };

    if (trocarSenha) {
      const senhaAtual = String(form.get("senhaAtual") ?? "");
      const novaSenha = String(form.get("novaSenha") ?? "");
      const confirmarNovaSenha = String(form.get("confirmarNovaSenha") ?? "");
      if (novaSenha !== confirmarNovaSenha) {
        setIssues({ confirmarNovaSenha: ["As senhas não coincidem."] });
        return;
      }
      payload.senhaAtual = senhaAtual;
      payload.novaSenha = novaSenha;
      payload.confirmarNovaSenha = confirmarNovaSenha;
    }

    setSaving(true);
    const result = await apiPatchJson<{ ok: true; nome: string }>(`/api/${role}/me`, payload);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    toast.success("Perfil atualizado com sucesso.");
    onSaved?.(result.data.nome);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Editar perfil</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">Carregando…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="nome">
                Nome completo
              </label>
              <input
                id="nome"
                name="nome"
                required
                defaultValue={nome}
                className={inputClass}
                autoComplete="name"
              />
              <FieldError message={issues.nome?.[0]} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                value={email}
                disabled
                className={inputClass + " cursor-not-allowed opacity-60"}
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                O e-mail não pode ser alterado por aqui.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="telefone">
                Telefone (com DDD)
              </label>
              <input
                id="telefone"
                name="telefone"
                required
                defaultValue={telefone}
                className={inputClass}
                autoComplete="tel"
              />
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
              <FieldError message={issues.cpf?.[0]} />
            </div>

            <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={trocarSenha}
                  onChange={(e) => setTrocarSenha(e.target.checked)}
                />
                Trocar senha
              </label>

              {trocarSenha && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="senhaAtual">
                      Senha atual
                    </label>
                    <PasswordInput id="senhaAtual" name="senhaAtual" autoComplete="current-password" />
                    <FieldError message={issues.senhaAtual?.[0]} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="novaSenha">
                      Nova senha
                    </label>
                    <PasswordInput id="novaSenha" name="novaSenha" minLength={8} autoComplete="new-password" />
                    <FieldError message={issues.novaSenha?.[0]} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="confirmarNovaSenha">
                      Repetir nova senha
                    </label>
                    <PasswordInput
                      id="confirmarNovaSenha"
                      name="confirmarNovaSenha"
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <FieldError message={issues.confirmarNovaSenha?.[0]} />
                  </div>
                </div>
              )}
            </div>

            {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className={secondaryButtonClass} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} className={primaryButtonClass + " sm:w-auto"}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
