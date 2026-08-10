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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WakeLockSentinel pode não estar no lib.dom.d.ts do TS instalado
  const wakeLockRef = useRef<any>(null);

  // Mantém a tela ligada enquanto compartilha — a causa mais comum de "o GPS
  // parou sozinho" é o celular apagar a tela e o navegador suspender os
  // timers/callbacks de geolocalização. Só ajuda enquanto a aba está em
  // primeiro plano (é uma limitação da própria API); trocar de app ou
  // bloquear o aparelho manualmente ainda pode pausar o envio — isso não dá
  // pra contornar numa aplicação web comum, só com um app nativo.
  const requestWakeLock = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
    } catch {
      // Falha silenciosa (ex: navegador sem suporte, ou aba não visível no
      // momento do pedido) — é só uma melhoria, não algo crítico.
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release?.().catch(() => {});
    wakeLockRef.current = null;
  }, []);

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
    releaseWakeLock();
    setStatus("parado");
  }, [releaseWakeLock]);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Este navegador não suporta geolocalização.");
      setStatus("erro");
      return;
    }

    setError(null);
    setStatus("ativando");
    void requestWakeLock();

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
  }, [sendPosition, requestWakeLock]);

  // O wake lock é liberado automaticamente pelo navegador quando a aba fica
  // em segundo plano (troca de aba/app, tela bloqueada) — reconquista assim
  // que a aba volta a ficar visível, enquanto o compartilhamento continuar
  // ativo. Isso é o máximo que dá pra fazer numa aplicação web comum: ajuda
  // a tela não apagar sozinha enquanto o motorista está de fato olhando pro
  // celular, mas não força o SO a manter o app rodando em segundo plano de
  // verdade (isso só um app nativo consegue).
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && watchIdRef.current !== null) {
        void requestWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [requestWakeLock]);

  // Encerra o watch (e libera o wake lock) ao desmontar — proteção extra
  // para quando o hook realmente sai da árvore (ex: logout), já que durante
  // a navegação normal entre páginas do motorista ele agora fica montado no
  // layout compartilhado e nunca desmonta sozinho.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return { status, error, lastSentAt, start, stop };
}
