"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type MapaExpandidoContextValue = {
  expandido: boolean;
  setExpandido: (expandido: boolean) => void;
};

const MapaExpandidoContext = createContext<MapaExpandidoContextValue | null>(null);

/**
 * Deixa um mapa em tela cheia (ver MapFullscreen.tsx, usado por
 * RotaMapInner.tsx e VehicleMapInner.tsx) avisar o AppHeader pra se esconder
 * enquanto estiver expandido.
 *
 * Por que não dá só pra resolver com z-index: o wrapper em volta do mapa
 * (`isolate`, ver RotaPanel.tsx/BuscarPlacaClient.tsx) existe pra conter os
 * controles internos do Leaflet (z-index até 1000) e não deixá-los vazar por
 * cima de menus/diálogos da aplicação. Só que isso cria um novo contexto de
 * empilhamento CSS — o que significa que o z-index alto do mapa expandido
 * (position: fixed + z-[1500]) fica preso dentro desse contexto e nunca
 * consegue ficar por cima do AppHeader (que vive fora dele, com z-30), por
 * mais alto que o z-index do mapa seja. A única forma correta de "esconder"
 * o header nesse caso é não renderizá-lo mesmo, daí este contexto.
 */
export function MapaExpandidoProvider({ children }: { children: ReactNode }) {
  const [expandido, setExpandido] = useState(false);
  return <MapaExpandidoContext.Provider value={{ expandido, setExpandido }}>{children}</MapaExpandidoContext.Provider>;
}

export function useMapaExpandido(): MapaExpandidoContextValue {
  const ctx = useContext(MapaExpandidoContext);
  // Fora do provider (alguma tela que não usa MotoristaShell/ResponsavelShell),
  // finge que nunca está expandido — nunca esconde nada por engano.
  return ctx ?? { expandido: false, setExpandido: () => {} };
}
