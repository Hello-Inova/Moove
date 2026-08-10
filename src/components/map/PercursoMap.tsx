"use client";

import dynamic from "next/dynamic";

const PercursoMapInner = dynamic(() => import("@/components/map/PercursoMapInner").then((m) => m.PercursoMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      Carregando mapa…
    </div>
  ),
});

export function PercursoMap(props: { pontos: [number, number][] }) {
  return <PercursoMapInner {...props} />;
}
