import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";

const NAV = [
  { href: "/responsavel/dashboard", label: "Meus vínculos" },
  { href: "/responsavel/vincular", label: "Usar convite" },
  { href: "/responsavel/buscar", label: "Buscar por placa" },
];

export function ResponsavelShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/responsavel/dashboard" className="font-semibold">
            Moove <span className="font-normal text-neutral-500">· responsável</span>
          </Link>
          <LogoutButton role="responsavel" />
        </div>
        <nav className="mx-auto flex max-w-3xl gap-4 overflow-x-auto px-4 pb-2 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-neutral-600 hover:text-neutral-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
