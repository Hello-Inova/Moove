"use client";

import dynamic from "next/dynamic";

const PinPickerInner = dynamic(() => import("@/components/map/PinPickerInner").then((m) => m.PinPickerInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      Carregando mapa…
    </div>
  ),
});

/**
 * Mapa com um pino arrastável (ou ajustável por clique/toque) usado para o
 * responsável confirmar ou corrigir a localização encontrada automaticamente
 * pela geocodificação — o provedor (LocationIQ/Nominatim) às vezes acerta a
 * cidade/rua mas erra o ponto exato, então deixamos a pessoa confirmar
 * visualmente em vez de confiar cegamente na coordenada.
 */
export function PinPicker(props: { latitude: number; longitude: number; onChange: (lat: number, lng: number) => void }) {
  return <PinPickerInner {...props} />;
}
