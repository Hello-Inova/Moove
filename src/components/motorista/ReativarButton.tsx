"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { apiPostJson } from "@/lib/api-client";
import { secondaryButtonClass } from "@/components/ui/form-elements";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export function ReativarButton({ url }: { url: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (
      !(await confirm("Reativar este vínculo? Um novo ciclo de 30 dias de cobrança começa a contar agora.", {
        confirmLabel: "Reativar",
      }))
    )
      return;

    setLoading(true);
    const result = await apiPostJson(url, {});
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Vínculo reativado.");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={secondaryButtonClass + " inline-flex w-auto items-center gap-1.5 px-3 py-1.5 text-xs"}
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      {loading ? "Reativando…" : "Reativar"}
    </button>
  );
}
