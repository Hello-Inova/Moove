"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { apiDelete } from "@/lib/api-client";
import { dangerButtonClass } from "@/components/ui/form-elements";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export function VeiculoDeleteButton({
  id,
  placa,
  onDeleted,
}: {
  id: string;
  placa: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (
      !(await confirm(`Excluir o veículo "${placa}"? Você pode cadastrar outro logo em seguida.`, {
        danger: true,
        confirmLabel: "Excluir",
      }))
    )
      return;

    setLoading(true);
    const result = await apiDelete(`/api/motorista/veiculos/${id}`);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Veículo excluído.");
    router.refresh();
    onDeleted?.();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className={dangerButtonClass + " inline-flex w-auto items-center gap-1.5 px-3 py-1.5 text-xs"}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      {loading ? "Excluindo…" : "Excluir"}
    </button>
  );
}
