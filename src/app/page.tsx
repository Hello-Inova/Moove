import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Moove</h1>
        <p className="mx-auto max-w-md text-neutral-600">
          Rastreamento em tempo real de vans, ônibus e peruas escolares. Motoristas
          compartilham a localização da rota; pais e responsáveis acompanham no mapa.
        </p>
      </div>

      <div className="grid w-full max-w-md gap-4 sm:grid-cols-2">
        <Link
          href="/motorista/login"
          className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-neutral-400 hover:shadow-md"
        >
          <p className="text-lg font-semibold">Sou motorista</p>
          <p className="mt-1 text-sm text-neutral-500">
            Compartilhe sua localização e gerencie convites dos responsáveis.
          </p>
        </Link>
        <Link
          href="/responsavel/login"
          className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-neutral-400 hover:shadow-md"
        >
          <p className="text-lg font-semibold">Sou responsável</p>
          <p className="mt-1 text-sm text-neutral-500">
            Acompanhe no mapa o veículo que transporta seu filho.
          </p>
        </Link>
      </div>

      <Link href="/privacidade" className="text-sm text-neutral-500 underline">
        Política de privacidade
      </Link>
    </main>
  );
}
