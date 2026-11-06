"use client";

import { useState, type FormEvent } from "react";
import { Search, School, BusFront } from "lucide-react";

import { apiGet } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";

type Resultado = {
  id: string;
  nome: string;
  escolas: { nome: string; endereco: string }[];
  veiculos: string[];
};

export function BuscarMotoristasClient() {
  const [escola, setEscola] = useState("");
  const [endereco, setEndereco] = useState("");
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function pesquisar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);
    const query = new URLSearchParams({ escola, endereco });
    const result = await apiGet<Resultado[]>(`/api/responsavel/motoristas/buscar?${query}`);
    setCarregando(false);
    if (!result.ok) {
      setResultados(null);
      setErro(result.error);
      return;
    }
    setResultados(result.data);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={pesquisar} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 sm:grid-cols-2" noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="escola">Escola</label>
          <input id="escola" value={escola} onChange={(e) => setEscola(e.target.value)} className={inputClass} placeholder="Ex.: Colégio Central" required minLength={2} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="endereco">Endereço da escola</label>
          <input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} className={inputClass} placeholder="Rua, bairro, cidade ou CEP" required minLength={3} />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={carregando} className={primaryButtonClass + " inline-flex w-auto items-center gap-2 px-4"}>
            <Search className="h-4 w-4" aria-hidden="true" />
            {carregando ? "Pesquisando…" : "Pesquisar motoristas"}
          </button>
        </div>
      </form>

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
      {resultados?.length === 0 && <p className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Nenhum motorista ativo foi encontrado para essa escola e endereço.</p>}

      {resultados && resultados.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{resultados.length} motorista{resultados.length === 1 ? " encontrado" : "s encontrados"}</p>
          {resultados.map((motorista) => (
            <article key={motorista.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-brand-orange-soft p-2 text-brand-orange-dark dark:bg-brand-orange/15 dark:text-brand-orange-light"><BusFront className="h-5 w-5" aria-hidden="true" /></div>
                <div>
                  <h2 className="font-semibold">{motorista.nome}</h2>
                  {motorista.veiculos.length > 0 && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Veículo{motorista.veiculos.length > 1 ? "s" : ""}: {motorista.veiculos.join(", ")}</p>}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {motorista.escolas.map((item) => <p key={`${item.nome}-${item.endereco}`} className="flex gap-2 text-neutral-600 dark:text-neutral-300"><School className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" /><span><strong>{item.nome}</strong><br />{item.endereco}</span></p>)}
              </div>
              <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">Para solicitar o vínculo, peça ao motorista um código de convite no Moove.</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
