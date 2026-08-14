"use client";

import { useEffect, useRef, useState } from "react";
import { distanciaAtePolilinha } from "@/lib/geo/distancia";

// Acima dessa distância do traçado da rota, consideramos que o motorista se
// desviou — abaixo disso é só a imprecisão normal do GPS (alguns metros) ou
// estar do outro lado da rua.
const DESVIO_LIMIAR_M = 60;

/**
 * Acumula um rastro (trilha de pontos) da posição do motorista enquanto ele
 * estiver fora do traçado da rota atual — some quando a rota é recalculada
 * (a `geometria` muda de referência, o que só acontece quando um novo
 * cálculo é aplicado, ver RotaPanel.tsx / buscar-placa/route.ts) ou quando
 * a posição some.
 *
 * Comparação por *referência* de `geometria` de propósito: entre um
 * recálculo e outro a mesma array (vinda do state) é reutilizada em toda
 * atualização de GPS — só muda de fato quando um recálculo é aplicado.
 */
export function useDesvioTrail(
  posicao: { latitude: number; longitude: number } | null | undefined,
  geometria: [number, number][] | null | undefined
): [number, number][] {
  const [trail, setTrail] = useState<[number, number][]>([]);
  const geometriaRef = useRef(geometria);

  useEffect(() => {
    if (geometria !== geometriaRef.current) {
      geometriaRef.current = geometria;
      setTrail([]);
    }
  }, [geometria]);

  useEffect(() => {
    if (!posicao || !geometria || geometria.length < 2) return;

    const distancia = distanciaAtePolilinha(posicao, geometria);
    if (distancia > DESVIO_LIMIAR_M) {
      setTrail((atual) => [...atual, [posicao.latitude, posicao.longitude]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicao?.latitude, posicao?.longitude, geometria]);

  return trail;
}
