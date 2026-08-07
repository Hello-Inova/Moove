"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiPostJson } from "@/lib/api-client";

// Alinhado com a recomendação do produto: reenviar a cada 10-15s enquanto a
// aba estiver ativa. `watchPosition` pode disparar com mais frequência do
// que isso (GPS de alta precisão), então limitamos o envio ao servidor.
const SEND_INTERVAL_MS = 12_000;

export type LocationSharingStatus = "parado" | "ativando" | "compartilhando" | "erro";

export function useLocationSharing() {
  const [status, setStatus] = useState<LocationSharingStatus>("parado");
  const [error, setError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const sendingRef = useRef(false);

  const sendPosition = useCallback(async (pos: GeolocationPosition) => {
    const now = Date.now();
    if (now - lastSentRef.current < SEND_INTERVAL_MS || sendingRef.current) return;

    sendingRef.current = true;
    lastSentRef.current = now;

    const result = await apiPostJson("/api/motorista/localizacao", {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });

    sendingRef.current = false;

    if (result.ok) {
      setLastSentAt(new Date());
      setError(null);
    } else {
      setError(result.error);
    }
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus("parado");
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Este navegador não suporta geolocalização.");
      setStatus("erro");
      return;
    }

    setError(null);
    setStatus("ativando");

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus("compartilhando");
        void sendPosition(pos);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada. Habilite o GPS do navegador para compartilhar sua rota."
            : "Não foi possível obter sua localização. Verifique se o GPS está ligado."
        );
        setStatus("erro");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
    );

    watchIdRef.current = id;
  }, [sendPosition]);

  // Encerra o watch ao desmontar (ex: navegação para outra página) — o
  // compartilhamento nunca continua "escondido" sem o usuário saber.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { status, error, lastSentAt, start, stop };
}
