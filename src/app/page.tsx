import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 bg-gradient-to-b from-brand-orange-soft/40 to-white px-6 py-16 text-center">
      <div className="space-y-4">
        <Logo height={56} className="mx-auto" />
        <p className="mx-auto max-w-md text-neutral-600">
          Rastreamento em tempo real de vans, ônibus e peruas escolares. Motoristas
          compartilham a localização da rota; pais e responsáveis acompanham no mapa.
        </p>
      </div>

      <div className="grid w-full max-w-md gap-4 sm:grid-cols-2">
        <Link
          href="/motorista/login"
          className="group rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-orange hover:shadow-md"
        >
          <p className="text-lg font-semibold text-brand-navy group-hover:text-brand-orange-dark">
            Sou motorista
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Compartilhe sua localização e gerencie convites dos responsáveis.
          </p>
        </Link>
        <Link
          href="/responsavel/login"
          className="group rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-orange hover:shadow-md"
        >
          <p className="text-lg font-semibold text-brand-navy group-hover:text-brand-orange-dark">
            Sou responsável
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Acompanhe no mapa o veículo que transporta seu filho.
          </p>
        </Link>
      </div>

      <Link href="/privacidade" className="text-sm text-neutral-500 underline underline-offset-2">
        Política de privacidade
      </Link>
    </main>
  );
}
