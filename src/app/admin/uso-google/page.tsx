import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { resumoUsoApis } from "@/lib/uso-api-externa";
import { nivelPorPercentual, COR_BADGE, COR_BARRA, LABEL_NIVEL } from "@/lib/uso-api-externa-cores";
import { AdminShell } from "@/components/admin/AdminShell";
import { cardClass } from "@/components/ui/form-elements";

export default async function AdminUsoGooglePage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const resumo = await resumoUsoApis();

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Uso das APIs do Google</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Quanto do limite gratuito mensal (~10.000 chamadas cada) já foi consumido em cada integração paga com o
            Google. A contagem reinicia todo mês; passar do limite não trava o app — só passa a gerar fatura (ver
            preços atuais em{" "}
            <a
              href="https://mapsplatform.google.com/pricing/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              mapsplatform.google.com/pricing
            </a>
            ).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {resumo.map((item) => {
            const nivel = nivelPorPercentual(item.percentual, item.configurada);
            const larguraBarra = Math.min(item.percentual, 100);

            return (
              <div key={item.api} className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-medium">{item.label}</h2>
                  {item.configurada ? (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COR_BADGE[nivel]}`}>
                      {LABEL_NIVEL[nivel]}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                      Não configurada
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{item.descricao}</p>

                {item.configurada ? (
                  <>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full ${COR_BARRA[nivel]}`}
                        style={{ width: `${larguraBarra}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                      {item.contagem.toLocaleString("pt-BR")} de {item.limite.toLocaleString("pt-BR")} usadas este
                      mês ({item.percentual}%)
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-neutral-400 dark:text-neutral-500">
                    Configure a chave correspondente no ambiente pra ativar essa integração.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
