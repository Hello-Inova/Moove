"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { ParadaRota } from "@/app/api/motorista/rota/route";

const motoristaIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function paradaIcon(sequencia: number, concluida: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      width:28px; height:28px; border-radius:9999px;
      background:${concluida ? "#16a34a" : "#f97316"};
      color:white; font:600 13px/1 system-ui, sans-serif;
      border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,.4);
    ">${concluida ? "✓" : sequencia}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function FitBounds({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pontos.length === 0) return;
    if (pontos.length === 1) {
      map.setView(pontos[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(pontos), { padding: [32, 32] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pontos)]);
  return null;
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

  return (
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
          icon={paradaIcon(p.sequencia, concluidas.has(p.vinculoId))}
        >
          <Popup>
            <strong>
              {p.sequencia}. {p.alunoNome}
            </strong>
            <br />
            {p.enderecoResumo}
          </Popup>
        </Marker>
      ))}

      {geometria && geometria.length > 1 && (
        <Polyline positions={geometria} pathOptions={{ color: "#1e293b", weight: 4, opacity: 0.8 }} />
      )}

      <FitBounds pontos={pontos} />
    </MapContainer>
  );
}
