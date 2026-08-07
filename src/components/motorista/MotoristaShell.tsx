import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { LocationSharingProvider } from "@/contexts/LocationSharingContext";

const NAV = [
  { href: "/motorista/dashboard", label: "Rota" },
  { href: "/motorista/veiculos", label: "Veículo" },
  { href: "/motorista/convites", label: "Convites" },
  { href: "/motorista/vinculos", label: "Vínculos" },
  { href: "/motorista/cobrancas", label: "Cobranças" },
];

export function MotoristaShell({ children }: { children: ReactNode }) {
  return (
    <LocationSharingProvider>
      <div className="flex min-h-full flex-1 flex-col bg-neutral-50">
        <AppHeader role="motorista" roleLabel="motorista" homeHref="/motorista/dashboard" nav={NAV} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      </div>
    </LocationSharingProvider>
  );
}
