import type { PlanoDefinicao } from "@/lib/subscription/plans";
import { formatarBRL } from "@/lib/subscription/plans";

export function PlanCard({
  plano,
  ativo,
  selecionado,
  onSelecionar,
}: {
  plano: PlanoDefinicao;
  ativo: boolean;
  selecionado: boolean;
  onSelecionar: () => void;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition dark:bg-neutral-900 ${
        selecionado ? "border-brand-orange ring-2 ring-brand-orange/25" : "border-neutral-200 dark:border-neutral-700"
      }`}
    >
      {plano.destaque && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand-orange px-3 py-1 text-xs font-medium text-white">
          {plano.destaque}
        </span>
      )}

      <h3 className="text-lg font-semibold text-brand-navy dark:text-white">{plano.label}</h3>
      <p className="mt-1 text-3xl font-bold text-brand-navy dark:text-white">
        {formatarBRL(plano.valorBase)}
        <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400"> pré-pago</span>
      </p>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{plano.cicloLabel}</p>

      <ul className="mt-4 flex-1 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
        {plano.recursos.map((r, i) => (
          <li key={`${r}-${i}`} className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0 text-brand-orange" fill="none">
              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{r}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onSelecionar}
        disabled={ativo}
        className={`mt-6 rounded-xl px-4 py-2.5 font-medium transition disabled:cursor-default ${
          ativo
            ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
            : selecionado
              ? "bg-brand-orange text-white hover:bg-brand-orange-dark"
              : "bg-brand-navy text-white hover:bg-brand-navy-light"
        }`}
      >
        {ativo ? "Plano atual" : "Assinar"}
      </button>
    </div>
  );
}
