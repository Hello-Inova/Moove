"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const inicioIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#16a34a;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const fimIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#dc2626;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitBounds({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pontos.length === 0) return;
    if (pontos.length === 1) {
      map.setView(pontos[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(pontos), { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pontos)]);
  return null;
}

/** Mapa somente-leitura do trajeto percorrido — usado no relatório diário. */
export function PercursoMapInner({ pontos }: { pontos: [number, number][] }) {
  if (pontos.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        Nenhum ponto de GPS registrado neste percurso.
      </div>
    );
  }

  return (
    <MapContainer center={pontos[0]} zoom={15} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={pontos} pathOptions={{ color: "#1e293b", weight: 4, opacity: 0.8 }} />
      <Marker position={pontos[0]} icon={inicioIcon}>
        <Popup>Início</Popup>
      </Marker>
      {pontos.length > 1 && (
        <Marker position={pontos[pontos.length - 1]} icon={fimIcon}>
          <Popup>Fim</Popup>
        </Marker>
      )}
      <FitBounds pontos={pontos} />
    </MapContainer>
  );
}
