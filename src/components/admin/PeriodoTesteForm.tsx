"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { apiPutJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";

export function PeriodoTesteForm({ diasIniciais }: { diasIniciais: number }) {
  const [dias, setDias] = useState(diasIniciais);
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSalvando(true);
    const result = await apiPutJson<{ dias: number }>("/api/admin/configuracoes/periodo-teste", { dias });
    setSalvando(false);
    if (!result.ok) return toast.error(result.error);
    setDias(result.data.dias);
    toast.success("Período de teste atualizado.");
  }

  return <form onSubmit={salvar} className="mt-5 flex flex-wrap items-end gap-3">
    <div>
      <label htmlFor="periodo-teste" className="mb-1 block text-sm font-medium">Dias de teste grátis</label>
      <input id="periodo-teste" type="number" min={0} max={365} value={dias} onChange={(e) => setDias(Number(e.target.value))} className={inputClass + " w-32"} />
    </div>
    <button type="submit" disabled={salvando} className={primaryButtonClass + " w-auto px-4 py-2"}>
      {salvando ? "Salvando…" : "Salvar período"}
    </button>
  </form>;
}
