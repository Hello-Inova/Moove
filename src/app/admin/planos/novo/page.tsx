import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { AdminShell } from "@/components/admin/AdminShell";
import { PlanoForm } from "@/components/admin/PlanoForm";

export default async function AdminNovoPlanoPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <Link href="/admin/planos" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
            ← Planos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Novo plano</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Assim que criado, o plano aparece na vitrine do motorista se estiver marcado como ativo.
          </p>
        </div>

        <PlanoForm />
      </div>
    </AdminShell>
  );
}
