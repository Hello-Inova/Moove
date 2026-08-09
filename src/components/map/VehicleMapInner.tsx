"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Os ícones padrão do Leaflet referenciam URLs relativas ao pacote que não
// resolvem no bundler do Next.js. Servimos as mesmas imagens via /public.
const vehicleIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Ícone diferente pro destino (endereço do responsável) — verde, pra não
// confundir com o marcador azul-padrão do veículo.
const destinoIcon = L.divIcon({
  className: "",
  html: `<div style="
    display:flex; align-items:center; justify-content:center;
    width:26px; height:26px; border-radius:9999px;
    background:#16a34a; color:white; font:600 14px/1 system-ui, sans-serif;
    border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,.4);
  ">🏠</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude]);
  }, [latitude, longitude, map]);
  return null;
}

function FitBounds({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pontos.length < 2) return;
    map.fitBounds(L.latLngBounds(pontos), { padding: [32, 32] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pontos)]);
  return null;
}

export function VehicleMapInner({
  latitude,
  longitude,
  label,
  destino,
  geometria,
}: {
  latitude: number;
  longitude: number;
  label: string;
  /** Endereço do responsável — quando presente, desenha o marcador de
   * destino e (se houver `geometria`) o traçado até lá. */
  destino?: { latitude: number; longitude: number } | null;
  geometria?: [number, number][] | null;
}) {
  const temDestino = !!destino;

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={vehicleIcon}>
        <Popup>{label}</Popup>
      </Marker>

      {destino && (
        <Marker position={[destino.latitude, destino.longitude]} icon={destinoIcon}>
          <Popup>Seu endereço</Popup>
        </Marker>
      )}

      {geometria && geometria.length > 1 && (
        <Polyline positions={geometria} pathOptions={{ color: "#1e293b", weight: 4, opacity: 0.8 }} />
      )}

      {/* Sem destino, mantém o comportamento de antes (recentraliza no
          veículo a cada atualização); com destino, ajusta o zoom pra
          mostrar as duas pontas do trajeto de uma vez. */}
      {temDestino ? (
        <FitBounds pontos={[[latitude, longitude], [destino!.latitude, destino!.longitude]]} />
      ) : (
        <Recenter latitude={latitude} longitude={longitude} />
      )}
    </MapContainer>
  );
}
