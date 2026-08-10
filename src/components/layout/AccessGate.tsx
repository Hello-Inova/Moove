"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { primaryButtonClass } from "@/components/ui/form-elements";
import { LogoutButton } from "@/components/auth/LogoutButton";

/**
 * Bloqueia o conteúdo da página inteira quando o teste grátis acabou e não
 * há assinatura ATIVA — só libera as rotas em `allowlist` (a própria tela de
 * planos/assinatura, pra dar pra pagar) e continua deixando sair (logout).
 * Client component porque precisa do pathname atual pra decidir isso.
 */
export function AccessGate({
  bloqueado,
  allowlist,
  planosHref,
  role,
  children,
}: {
  bloqueado: boolean;
  allowlist: string[];
  planosHref: string;
  role: "motorista" | "responsavel";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const liberado = !bloqueado || allowlist.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  if (liberado) return <>{children}</>;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center sm:p-8">
      <h1 className="text-xl font-semibold">Seu período de teste acabou</h1>
      <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
        Assine um plano para continuar usando o Moove. Seus dados continuam salvos — nada foi perdido.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href={planosHref} className={primaryButtonClass + " w-auto px-6"}>
          Ver planos e assinar
        </Link>
        <LogoutButton role={role} />
      </div>
    </div>
  );
}
