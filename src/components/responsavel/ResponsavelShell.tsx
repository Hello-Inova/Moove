import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";

const NAV = [
  { href: "/responsavel/dashboard", label: "Meus vínculos" },
  { href: "/responsavel/vincular", label: "Usar convite" },
  { href: "/responsavel/buscar", label: "Ver localização" },
];

export function ResponsavelShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
      <AppHeader role="responsavel" roleLabel="responsável" homeHref="/responsavel/dashboard" nav={NAV} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
