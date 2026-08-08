import Link from "next/link";

import type { StatusAssinatura } from "@prisma/client";

export function TrialBanner({
  status,
  diasRestantes,
}: {
  status: StatusAssinatura | "SEM_ASSINATURA";
  diasRestantes: number | null;
}) {
  if (status === "ATIVA" || status === "CANCELADA") return null;

  if (status === "SEM_ASSINATURA") {
    return (
      <Banner tone="info">
        Comece seu teste grátis de 7 dias — escolha um plano para liberar convites e vínculos.{" "}
        <Link href="/motorista/planos" className="font-medium underline underline-offset-2">
          Ver planos
        </Link>
      </Banner>
    );
  }

  if (status === "TESTE") {
    const tone = diasRestantes !== null && diasRestantes <= 2 ? "warning" : "info";
    return (
      <Banner tone={tone}>
        Período de teste: {diasRestantes ?? 0} dia(s) restante(s).{" "}
        <Link href="/motorista/planos" className="font-medium underline underline-offset-2">
          Assinar plano
        </Link>
      </Banner>
    );
  }

  // EXPIRADA
  return (
    <Banner tone="danger">
      Seu período de teste ou assinatura expirou — novos convites ficam bloqueados até você assinar um plano.{" "}
      <Link href="/motorista/planos" className="font-medium underline underline-offset-2">
        Assinar agora
      </Link>
    </Banner>
  );
}

const TONE_CLASS: Record<"info" | "warning" | "danger", string> = {
  info: "bg-brand-navy/5 text-brand-navy",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
};

function Banner({ tone, children }: { tone: "info" | "warning" | "danger"; children: React.ReactNode }) {
  return (
    <div className={`px-4 py-1.5 text-center text-xs sm:text-sm ${TONE_CLASS[tone]}`}>{children}</div>
  );
}
