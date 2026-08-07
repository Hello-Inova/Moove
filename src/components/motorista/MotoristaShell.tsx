import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";

const NAV = [
  { href: "/motorista/dashboard", label: "Rota" },
  { href: "/motorista/veiculos", label: "Veículo" },
  { href: "/motorista/convites", label: "Convites" },
  { href: "/motorista/vinculos", label: "Vínculos" },
  { href: "/motorista/cobrancas", label: "Cobranças" },
];

export function MotoristaShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/motorista/dashboard" className="font-semibold">
            Moove <span className="font-normal text-neutral-500">· motorista</span>
          </Link>
          <LogoutButton role="motorista" />
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
