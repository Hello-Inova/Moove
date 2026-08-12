"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { apiDelete } from "@/lib/api-client";
import { dangerButtonClass } from "@/components/ui/form-elements";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export function AdminDeleteButton({
  url,
  confirmMessage,
  redirectTo,
}: {
  url: string;
  confirmMessage: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!(await confirm(confirmMessage, { danger: true, confirmLabel: "Excluir" }))) return;

    setLoading(true);
    const result = await apiDelete(url);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Excluído com sucesso.");
    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <button onClick={handleClick} disabled={loading} className={dangerButtonClass + " inline-flex items-center gap-1.5"}>
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      {loading ? "Excluindo…" : "Excluir"}
    </button>
  );
}
