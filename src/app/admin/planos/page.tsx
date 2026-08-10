import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { listarTodosPlanos } from "@/lib/subscription/planos-service";
import { formatarBRL } from "@/lib/subscription/plans";
import { AdminShell } from "@/components/admin/AdminShell";
import { PlanoAtivoToggle } from "@/components/admin/PlanoAtivoToggle";
import { primaryButtonClass } from "@/components/ui/form-elements";

export default async function AdminPlanosPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const planos = await listarTodosPlanos();

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Planos</h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              {planos.length} plano(s). Alterações aqui refletem imediatamente na vitrine do motorista
              (<code>/motorista/planos</code>).
            </p>
          </div>
          <Link href="/admin/planos/novo" className={primaryButtonClass + " w-auto px-4"}>
            Novo plano
          </Link>
        </div>

        {planos.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum plano cadastrado ainda.</p>}

        <div className="space-y-3">
          {planos.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/planos/${p.id}`} className="font-medium text-brand-navy hover:underline dark:text-white">
                    {p.label}
                  </Link>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    {p.codigo}
                  </span>
                  <span className="rounded-full bg-brand-orange-soft px-2 py-0.5 text-xs font-medium text-brand-orange-dark dark:bg-brand-orange/15 dark:text-brand-orange-light">
                    {p.publico === "RESPONSAVEL" ? "Responsável" : "Motorista"}
                  </span>
                  {!p.ativo && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400">
                      Inativo
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {p.publico === "RESPONSAVEL"
                    ? `${formatarBRL(p.valorBase)}/aluno · ${p.cicloLabel}`
                    : `${formatarBRL(p.valorBase)} · ${p.cicloLabel} · ${p.alunosGratis} aluno(s) grátis`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PlanoAtivoToggle id={p.id} ativo={p.ativo} />
                <Link
                  href={`/admin/planos/${p.id}`}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200"
                >
                  Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
