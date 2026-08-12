"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { apiPostJson } from "@/lib/api-client";
import { dangerButtonClass } from "@/components/ui/form-elements";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export function RevogarButton({ url, confirmMessage }: { url: string; confirmMessage: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!(await confirm(confirmMessage, { danger: true, confirmLabel: "Revogar" }))) return;

    setLoading(true);
    const result = await apiPostJson(url, {});
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Vínculo revogado.");
    router.refresh();
  }

  return (
    <button onClick={handleClick} disabled={loading} className={dangerButtonClass + " inline-flex items-center gap-1.5"}>
      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
      {loading ? "Revogando…" : "Revogar"}
    </button>
  );
}
