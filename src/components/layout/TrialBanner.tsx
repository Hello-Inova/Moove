import Link from "next/link";

/**
 * Faixa de status do teste grátis (em nível de conta, ver
 * `Motorista.testeExpiraEm`/`Responsavel.testeExpiraEm`). Reaproveitada por
 * motorista e responsável — só muda o link de destino pra assinar.
 */
export function TrialBanner({
  emTeste,
  diasRestantes,
  assinaturaAtiva,
  planosHref,
}: {
  emTeste: boolean;
  diasRestantes: number;
  assinaturaAtiva: boolean;
  planosHref: string;
}) {
  if (assinaturaAtiva) return null;

  if (emTeste) {
    const tone = diasRestantes <= 2 ? "warning" : "info";
    return (
      <Banner tone={tone}>
        Período de teste grátis: {diasRestantes} dia(s) restante(s).{" "}
        <Link href={planosHref} className="font-medium underline underline-offset-2">
          Ver planos
        </Link>
      </Banner>
    );
  }

  return (
    <Banner tone="danger">
      Seu período de teste acabou — assine um plano para continuar usando o Moove.{" "}
      <Link href={planosHref} className="font-medium underline underline-offset-2">
        Assinar agora
      </Link>
    </Banner>
  );
}

const TONE_CLASS: Record<"info" | "warning" | "danger", string> = {
  info: "bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-neutral-200",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

function Banner({ tone, children }: { tone: "info" | "warning" | "danger"; children: React.ReactNode }) {
  return (
    <div className={`px-4 py-1.5 text-center text-xs sm:text-sm ${TONE_CLASS[tone]}`}>{children}</div>
  );
}
