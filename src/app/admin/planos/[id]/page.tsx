import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { buscarPlanoPorId } from "@/lib/subscription/planos-service";
import { AdminShell } from "@/components/admin/AdminShell";
import { PlanoForm } from "@/components/admin/PlanoForm";

export default async function AdminEditarPlanoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { id } = await params;
  const plano = await buscarPlanoPorId(id);
  if (!plano) notFound();

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <Link href="/admin/planos" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
            ← Planos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Editar plano {plano.label}</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Excluir só é permitido se este plano nunca foi usado em nenhuma assinatura — caso contrário, desative-o.
          </p>
        </div>

        <PlanoForm planoExistente={plano} />
      </div>
    </AdminShell>
  );
}
