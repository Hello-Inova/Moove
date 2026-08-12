import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";

type ChecklistItem = { label: string; href: string; done: boolean };

/**
 * Consolida os avisos soltos de "primeiros passos" do motorista (antes eram
 * banners independentes espalhados pelo dashboard) num único checklist com
 * barra de progresso. Some sozinho quando tudo estiver concluído — não faz
 * sentido continuar ocupando espaço depois que a conta está pronta pra uso.
 */
export function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const concluidos = items.filter((i) => i.done).length;
  if (concluidos === items.length) return null;

  const percentual = Math.round((concluidos / items.length) * 100);

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-medium">Primeiros passos</h2>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {concluidos}/{items.length}
        </span>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className="h-full rounded-full bg-brand-orange transition-all"
          style={{ width: `${percentual}%` }}
        />
      </div>

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href + item.label}>
            <Link
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                item.done ? "text-neutral-400 line-through dark:text-neutral-500" : "text-neutral-700 dark:text-neutral-200"
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
              )}
              <span className="flex-1">{item.label}</span>
              {!item.done && <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
