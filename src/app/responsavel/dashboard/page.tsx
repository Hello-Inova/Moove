import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { PushAlertaToggle } from "@/components/responsavel/PushAlertaToggle";

export default async function ResponsavelDashboardPage() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  // Isolamento: filtra estritamente pelo responsavelId autenticado.
  const vinculos = await prisma.vinculo.findMany({
    where: { responsavelId: responsavel.id },
    orderBy: { criadoEm: "desc" },
    include: {
      motorista: { select: { nome: true, veiculos: { select: { placa: true, modelo: true } } } },
      aluno: { select: { nome: true, enderecoLatitude: true, enderecoLongitude: true, enderecoConfirmado: true } },
      escola: { select: { nome: true } },
    },
  });

  // Endereço agora é por aluno (não mais por responsável) — junta os alunos
  // ATIVOS que ainda não têm endereço geocodificado ou não confirmaram o
  // pino, pra avisar por nome em vez de um banner genérico só.
  const alunosSemEndereco = vinculos.filter(
    (v) => v.status === "ATIVO" && (v.aluno.enderecoLatitude === null || v.aluno.enderecoLongitude === null)
  );
  const alunosSemConfirmar = vinculos.filter(
    (v) =>
      v.status === "ATIVO" &&
      v.aluno.enderecoLatitude !== null &&
      v.aluno.enderecoLongitude !== null &&
      !v.aluno.enderecoConfirmado
  );

  return (
    <ResponsavelShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {responsavel.nome.split(" ")[0]}</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Seus vínculos com motoristas</p>
        </div>

        {vinculos.length === 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Você ainda não tem nenhum vínculo.{" "}
            <Link href="/responsavel/vincular" className="font-medium underline">
              Usar um código de convite
            </Link>
          </div>
        )}

        <PushAlertaToggle />

        {alunosSemEndereco.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            Cadastre o endereço de {alunosSemEndereco.map((v) => v.aluno.nome).join(", ")} para que o motorista
            consiga traçar a rota.{" "}
            <Link href="/responsavel/alunos" className="font-medium underline">
              Cadastrar endereço
            </Link>
          </div>
        )}

        {alunosSemConfirmar.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            O endereço de {alunosSemConfirmar.map((v) => v.aluno.nome).join(", ")} ainda não foi confirmado no mapa —
            a localização automática pode estar imprecisa.{" "}
            <Link href="/responsavel/alunos" className="font-medium underline">
              Confirmar localização
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {vinculos.map((v) => (
            <div key={v.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 dark:bg-neutral-900 dark:border-neutral-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{v.aluno.nome}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Motorista: {v.motorista.nome} · Escola: {v.escola?.nome ?? "não definida"}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {v.motorista.veiculos.map((ve) => `${ve.placa} · ${ve.modelo}`).join(", ") || "Sem veículo cadastrado"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/responsavel/vinculos/${v.id}`}
                    className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    Mensalidade e contrato
                  </Link>
                  {v.status === "ATIVO" ? (
                    v.motorista.veiculos[0] && (
                      <Link
                        href={`/responsavel/buscar?placa=${encodeURIComponent(v.motorista.veiculos[0].placa)}`}
                        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                      >
                        Ver no mapa
                      </Link>
                    )
                  ) : (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                      Vínculo revogado
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ResponsavelShell>
  );
}
