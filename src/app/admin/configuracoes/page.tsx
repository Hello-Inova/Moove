import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { obterPeriodoTesteDias } from "@/lib/subscription/configuracao";
import { AdminShell } from "@/components/admin/AdminShell";
import { PeriodoTesteForm } from "@/components/admin/PeriodoTesteForm";

export default async function ConfiguracoesAdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const dias = await obterPeriodoTesteDias();
  return <AdminShell><section className="max-w-xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
    <h1 className="text-2xl font-semibold">Configurações</h1>
    <h2 className="mt-6 text-lg font-medium">Período de teste</h2>
    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Define quantos dias de teste gratuito serão concedidos a novas contas. Não altera testes que já começaram.</p>
    <PeriodoTesteForm diasIniciais={dias} />
  </section></AdminShell>;
}
