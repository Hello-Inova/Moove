"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiPostJson } from "@/lib/api-client";
import { secondaryButtonClass } from "@/components/ui/form-elements";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export function IsentoToggleButton({ motoristaId, isento }: { motoristaId: string; isento: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  const label = isento ? "Remover isenção" : "Isentar de cobrança";
  const confirmMessage = isento
    ? "Remover a isenção de cobrança? O motorista volta a ser bloqueado normalmente se a assinatura estiver vencida."
    : "Isentar este motorista de cobrança? Ele nunca mais vai ser bloqueado por assinatura vencida, até você remover a isenção.";

  async function handleClick() {
    if (!(await confirm(confirmMessage, { confirmLabel: label }))) return;

    setLoading(true);
    const result = await apiPostJson(`/api/admin/motoristas/${motoristaId}/isento`, { isento: !isento });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(isento ? "Isenção removida." : "Motorista isentado de cobrança.");
    router.refresh();
  }

  return (
    <button onClick={handleClick} disabled={loading} className={secondaryButtonClass}>
      {loading ? "Aguarde…" : label}
    </button>
  );
}
