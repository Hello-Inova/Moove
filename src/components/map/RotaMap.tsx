"use client";

import dynamic from "next/dynamic";

import type { ParadaRota } from "@/app/api/motorista/rota/route";

const RotaMapInner = dynamic(() => import("@/components/map/RotaMapInner").then((m) => m.RotaMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      Carregando mapa…
    </div>
  ),
});

export function RotaMap(props: {
  motorista: { latitude: number; longitude: number };
  paradas: ParadaRota[];
  concluidas: Set<string>;
  geometria: [number, number][] | null;
}) {
  return <RotaMapInner {...props} />;
}
