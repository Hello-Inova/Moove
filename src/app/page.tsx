import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ComoFuncionaFluxo } from "@/components/home/ComoFuncionaFluxo";

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-10 bg-gradient-to-b from-brand-orange-soft/40 to-white px-6 py-16 text-center dark:from-neutral-900 dark:to-neutral-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="space-y-4">
        <Logo height={56} className="mx-auto" />
        <p className="mx-auto max-w-md text-neutral-600 dark:text-neutral-300">
          Rastreamento em tempo real de vans, ônibus e peruas escolares. Motoristas
          compartilham a localização da rota; pais e responsáveis acompanham no mapa.
        </p>
      </div>

      <Link href="/login" className="w-full max-w-md rounded-2xl bg-brand-orange px-6 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-brand-orange-dark hover:shadow-md">
        Entrar na Moove
      </Link>

      <ComoFuncionaFluxo />

      <Link href="/privacidade" className="text-sm text-neutral-500 underline underline-offset-2 dark:text-neutral-400">
        Política de privacidade
      </Link>
    </main>
  );
}
