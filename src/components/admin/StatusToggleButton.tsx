"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiPostJson } from "@/lib/api-client";
import { secondaryButtonClass } from "@/components/ui/form-elements";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export function StatusToggleButton({ url, statusAtual }: { url: string; statusAtual: "ATIVA" | "SUSPENSA" }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  const proximoStatus = statusAtual === "ATIVA" ? "SUSPENSA" : "ATIVA";
  const label = statusAtual === "ATIVA" ? "Suspender" : "Reativar";
  const confirmMessage =
    statusAtual === "ATIVA"
      ? "Suspender esta conta? A pessoa não vai mais conseguir entrar no sistema."
      : "Reativar esta conta?";

  async function handleClick() {
    if (!(await confirm(confirmMessage, { confirmLabel: label, danger: statusAtual === "ATIVA" }))) return;

    setLoading(true);
    const result = await apiPostJson(url, { statusConta: proximoStatus });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(statusAtual === "ATIVA" ? "Conta suspensa." : "Conta reativada.");
    router.refresh();
  }

  return (
    <button onClick={handleClick} disabled={loading} className={secondaryButtonClass}>
      {loading ? "Aguarde…" : label}
    </button>
  );
}
