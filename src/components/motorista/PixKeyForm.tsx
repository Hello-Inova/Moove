"use client";

import { useState, type FormEvent } from "react";
import { apiPatchJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";

export function PixKeyForm({ chavePixAtual }: { chavePixAtual: string | null }) {
  const [editando, setEditando] = useState(!chavePixAtual);
  const [salvo, setSalvo] = useState(chavePixAtual);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const chavePix = String(form.get("chavePix") ?? "").trim();

    const result = await apiPatchJson<{ chavePix: string | null }>("/api/motorista/me", { chavePix });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSalvo(result.data.chavePix);
    setEditando(false);
  }

  if (!editando) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Sua chave PIX</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{salvo}</p>
        </div>
        <button onClick={() => setEditando(true)} className="text-sm font-medium text-brand-navy underline underline-offset-2 dark:text-brand-orange">
          Alterar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3" noValidate>
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-sm font-medium" htmlFor="chavePix">
          Sua chave PIX
        </label>
        <input
          id="chavePix"
          name="chavePix"
          defaultValue={salvo ?? ""}
          placeholder="CPF, e-mail, telefone ou chave aleatória"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Usada só pra preencher a mensagem de cobrança no WhatsApp — a plataforma não processa esse pagamento.
        </p>
      </div>
      <button type="submit" disabled={loading} className={primaryButtonClass + " w-auto px-4"}>
        {loading ? "Salvando…" : "Salvar"}
      </button>
      {salvo && (
        <button type="button" onClick={() => setEditando(false)} className="text-sm text-neutral-500 underline underline-offset-2">
          Cancelar
        </button>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
