import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { expirarConvitesVencidos } from "@/lib/convite";
import { MotoristaShell } from "@/components/motorista/MotoristaShell";
import { GerarConviteButton } from "@/components/motorista/GerarConviteButton";
import { RevogarButton } from "@/components/motorista/RevogarButton";
import { CopyCodeButton } from "@/components/motorista/CopyCodeButton";

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  USADO: "Usado",
  EXPIRADO: "Expirado",
  REVOGADO: "Revogado",
};

const STATUS_CLASS: Record<string, string> = {
  PENDENTE: "bg-blue-100 text-blue-800",
  USADO: "bg-green-100 text-green-800",
  EXPIRADO: "bg-neutral-200 text-neutral-600",
  REVOGADO: "bg-red-100 text-red-700",
};

export default async function MotoristaConvitesPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  await expirarConvitesVencidos(motorista.id);

  const convites = await prisma.convite.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
    include: { usadoPorResponsavel: { select: { nome: true } } },
  });

  return (
    <MotoristaShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Convites</h1>
            <p className="text-neutral-500">
              Gere um código, válido por 7 dias e de uso único, para cada família se vincular.
            </p>
          </div>
          <GerarConviteButton />
        </div>

        <div className="space-y-3">
          {convites.length === 0 && (
            <p className="text-sm text-neutral-500">Nenhum convite gerado ainda.</p>
          )}
          {convites.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <CopyCodeButton codigo={c.codigo} />
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
              <div className="text-sm text-neutral-500">
                {c.status === "PENDENTE" && <span>Expira em {c.expiraEm.toLocaleDateString("pt-BR")}</span>}
                {c.status === "USADO" && <span>Usado por {c.usadoPorResponsavel?.nome}</span>}
              </div>
              {c.status === "PENDENTE" && (
                <RevogarButton
                  url={`/api/motorista/convites/${c.id}/revogar`}
                  confirmMessage="Revogar este convite? Ele deixará de poder ser usado."
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </MotoristaShell>
  );
}
