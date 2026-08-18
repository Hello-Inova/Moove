"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { ParadaRota } from "@/app/api/motorista/rota/route";
import { FullscreenButton, InvalidateOnResize, useFecharComEsc } from "@/components/map/MapFullscreen";
import { useDesvioTrail } from "@/lib/geo/useDesvioTrail";
import { useMapaExpandido } from "@/contexts/MapaExpandidoContext";

const motoristaIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** "Levi Brune" -> "LB", "Joca" -> "JO" (nome de uma palavra só, sem
 * sobrenome pra tirar a segunda inicial) — identifica o aluno no balão do
 * mapa sem precisar de legenda. */
function iniciaisNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function paradaIcon(alunoNome: string, concluida: boolean) {
  const rotulo = concluida ? "✓" : iniciaisNome(alunoNome);
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      width:30px; height:30px; border-radius:9999px;
      background:${concluida ? "#16a34a" : "#f97316"};
      color:white; font:700 11px/1 system-ui, sans-serif;
      border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,.4);
    ">${rotulo}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

/**
 * Ajusta o zoom/enquadramento pra mostrar motorista + paradas de uma vez —
 * mas só quando a ROTA muda (paradas/traçado), não a cada tick de GPS do
 * motorista (que agora atualiza a cada poucos segundos, não mais só a cada
 * 3min — ver RotaPanel.tsx). Se recalculasse o enquadramento a cada tick, o
 * mapa ficaria "puxando" o zoom/posição sozinho o tempo todo enquanto o
 * motorista dirige, brigando com quem está tentando olhar o mapa manualmente.
 * A posição atual do motorista ainda entra na conta (lida no momento em que
 * o efeito roda), só não é o que "dispara" o reenquadramento.
 */
function FitBounds({
  motorista,
  paradas,
}: {
  motorista: { latitude: number; longitude: number };
  paradas: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    const pontos: [number, number][] = [[motorista.latitude, motorista.longitude], ...paradas];
    if (pontos.length === 1) {
      map.setView(pontos[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(pontos), { padding: [32, 32] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(paradas)]);
  return null;
}

function TargetIcon({ ativo }: { ativo: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.2" fill={ativo ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Botão "seguir minha localização" (estilo Waze/Google Maps) — centraliza o
 * mapa na posição do motorista e, enquanto ativo, recentraliza a cada
 * atualização de GPS. Se o motorista arrastar o mapa manualmente, o modo
 * "seguir" desliga sozinho (mesmo comportamento dos apps de navegação).
 */
function FollowControl({ motorista }: { motorista: { latitude: number; longitude: number } }) {
  const map = useMap();
  const [seguindo, setSeguindo] = useState(false);
  const arrastandoProgramaticamente = useRef(false);

  useMapEvents({
    dragstart() {
      if (arrastandoProgramaticamente.current) return;
      setSeguindo(false);
    },
  });

  useEffect(() => {
    if (!seguindo) return;
    arrastandoProgramaticamente.current = true;
    map.setView([motorista.latitude, motorista.longitude], Math.max(map.getZoom(), 17), { animate: true });
    // Libera a trava no próximo tick — dá tempo do evento `dragstart` (que o
    // Leaflet as vezes dispara durante `setView` animado) ser ignorado.
    const timeout = setTimeout(() => {
      arrastandoProgramaticamente.current = false;
    }, 50);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seguindo, motorista.latitude, motorista.longitude]);

  return (
    <button
      type="button"
      onClick={() => setSeguindo((s) => !s)}
      aria-pressed={seguindo}
      aria-label={seguindo ? "Parar de seguir minha localização" : "Centralizar e seguir minha localização"}
      className={`absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border shadow-md transition ${
        seguindo
          ? "border-brand-orange bg-brand-orange text-white"
          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
      }`}
      style={{ zIndex: 1000 }}
    >
      <TargetIcon ativo={seguindo} />
    </button>
  );
}

export function RotaMapInner({
  motorista,
  paradas,
  concluidas,
  geometria,
}: {
  motorista: { latitude: number; longitude: number };
  paradas: ParadaRota[];
  concluidas: Set<string>;
  geometria: [number, number][] | null;
}) {
  const pontos: [number, number][] = [
    [motorista.latitude, motorista.longitude],
    ...paradas.map((p): [number, number] => [p.latitude, p.longitude]),
  ];

  const [expandido, setExpandido] = useState(false);
  const fecharFullscreen = useCallback(() => setExpandido(false), []);
  useFecharComEsc(expandido, fecharFullscreen);

  // Avisa o AppHeader (fora desse componente) pra se esconder enquanto o
  // mapa estiver em tela cheia — ver MapaExpandidoContext.tsx pro motivo de
  // não dar pra resolver só com z-index. Reseta ao desmontar (ex.: saiu da
  // página com o mapa ainda expandido) pra não deixar o header escondido
  // pra sempre.
  const { setExpandido: setExpandidoGlobal } = useMapaExpandido();
  useEffect(() => {
    setExpandidoGlobal(expandido);
    return () => setExpandidoGlobal(false);
  }, [expandido, setExpandidoGlobal]);

  // Rastro de quando o motorista sai do traçado — some sozinho assim que a
  // rota é recalculada (ver useDesvioTrail.ts).
  const rastroDesvio = useDesvioTrail(motorista, geometria);

  return (
    // `position: fixed` escapa do wrapper com altura fixa/overflow-hidden
    // que a página (RotaPanel.tsx) usa em volta do mapa — cobre a tela
    // inteira independente de onde o componente está montado no layout.
    <div className={expandido ? "fixed inset-0 z-[1500] bg-white dark:bg-neutral-950" : "relative h-full w-full"}>
      <MapContainer center={pontos[0]} zoom={14} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[motorista.latitude, motorista.longitude]} icon={motoristaIcon}>
          <Popup>Você está aqui</Popup>
        </Marker>

        {paradas.map((p) => (
          <Marker
            key={p.vinculoId}
            position={[p.latitude, p.longitude]}
            icon={paradaIcon(p.alunoNome, concluidas.has(p.vinculoId))}
          >
            <Popup>
              <strong>{p.alunoNome}</strong>
              <br />
              {p.enderecoResumo}
            </Popup>
          </Marker>
        ))}

        {geometria && geometria.length > 1 && (
          <Polyline positions={geometria} pathOptions={{ color: "#1e293b", weight: 4, opacity: 0.8 }} />
        )}

        {rastroDesvio.length > 1 && (
          <Polyline
            positions={rastroDesvio}
            pathOptions={{ color: "#dc2626", weight: 4, opacity: 0.85, dashArray: "6 8" }}
          />
        )}

        <FitBounds motorista={motorista} paradas={paradas.map((p): [number, number] => [p.latitude, p.longitude])} />
        <FollowControl motorista={motorista} />
        <FullscreenButton expandido={expandido} onToggle={() => setExpandido((e) => !e)} />
        <InvalidateOnResize watch={expandido} />
      </MapContainer>
    </div>
  );
}
