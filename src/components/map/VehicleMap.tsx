"use client";

import dynamic from "next/dynamic";

const VehicleMapInner = dynamic(
  () => import("@/components/map/VehicleMapInner").then((m) => m.VehicleMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500">
        Carregando mapa…
      </div>
    ),
  }
);

export function VehicleMap(props: { latitude: number; longitude: number; label: string }) {
  return <VehicleMapInner {...props} />;
}
