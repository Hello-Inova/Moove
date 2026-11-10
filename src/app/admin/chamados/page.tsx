import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/AdminShell";
import { ChamadosAdmin } from "@/components/admin/ChamadosAdmin";

export default async function ChamadosPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const chamados = await prisma.chamadoSuporte.findMany({
    orderBy: { criadoEm: "desc" },
    take: 200,
    include: { motorista: { select: { id: true } }, responsavel: { select: { id: true } } },
  });
  const dados = chamados.map(({ motorista, responsavel, ...chamado }) => ({ ...chamado, tipo: motorista ? "Motorista" : responsavel ? "Responsável" : "Usuário" }));
  return <AdminShell><div className="space-y-6"><div><h1 className="text-2xl font-semibold">Chamados</h1><p className="text-neutral-500">{dados.length} chamado(s) de suporte.</p></div>{dados.length ? <ChamadosAdmin iniciais={dados} /> : <p className="text-neutral-500">Nenhum chamado aberto.</p>}</div></AdminShell>;
}
