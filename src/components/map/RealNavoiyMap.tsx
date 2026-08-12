"use client";

// Real-world Leaflet map of the Navoiy region (OSM tiles). Client-only —
// imported via next/dynamic(ssr:false) from NavoiyMapPanel. Geography is real;
// all patient/screening figures are synthetic demo data.
import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_TILE_CONFIG, NAVOIY_DEFAULT } from "@/data/mapConfig";
import {
  MedTwinLocation,
  getMedTwinClinics,
  getMedTwinLocations,
  locationBounds,
  riskFor,
} from "@/data/navoiyLocations";
import { DispatchRecommendation } from "@/lib/types";
import {
  clinicDivIcon,
  movingClinicDivIcon,
  riskDivIcon,
} from "./markers";
import { ClinicPopup, LocationPopup } from "./popups";
import { useDispatchAnimation } from "./useDispatchAnimation";

// Frames the camera to all locations on mount; exposes an imperative reset.
function CameraController({
  bounds,
  focusId,
  locations,
  onReady,
}: {
  bounds: [[number, number], [number, number]];
  focusId?: string | null;
  locations: MedTwinLocation[];
  onReady: (m: LeafletMap) => void;
}) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40] });
    onReady(map);
  }, [map, bounds, onReady]);
  useEffect(() => {
    if (!focusId) return;
    const loc = locations.find((l) => l.id === focusId);
    if (loc) map.flyTo([loc.latitude, loc.longitude], 10, { duration: 0.8 });
  }, [map, focusId, locations]);
  return null;
}

export interface RealNavoiyMapProps {
  dispatched?: DispatchRecommendation | null;
  focusId?: string | null;
  showRisk: boolean;
  showClinics: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onTileError?: () => void;
}

export default function RealNavoiyMap({
  dispatched,
  focusId,
  showRisk,
  showClinics,
  selectedId,
  onSelect,
  onTileError,
}: RealNavoiyMapProps) {
  const locations = useMemo(() => getMedTwinLocations(), []);
  const clinics = useMemo(() => getMedTwinClinics(), []);
  const bounds = useMemo(() => locationBounds(locations), [locations]);
  const mapRef = useRef<LeafletMap | null>(null);

  const origin = dispatched
    ? clinics.find((c) => c.id === dispatched.clinicId)
    : undefined;
  const dest = dispatched
    ? locations.find((l) => l.id === dispatched.villageId)
    : undefined;
  const movingPos = useDispatchAnimation(origin, dest);

  return (
    <MapContainer
      center={NAVOIY_DEFAULT.center}
      zoom={NAVOIY_DEFAULT.zoom}
      className="h-full w-full"
      style={{ background: "var(--bg)" }}
      zoomControl={false}
      attributionControl
    >
      {/* Bottom-left so it doesn't collide with the header label / toggles. */}
      <ZoomControl position="bottomleft" />
      <TileLayer
        url={MAP_TILE_CONFIG.url}
        attribution={MAP_TILE_CONFIG.attribution}
        maxZoom={MAP_TILE_CONFIG.maxZoom}
        eventHandlers={{ tileerror: () => onTileError?.() }}
      />
      <CameraController
        bounds={bounds}
        focusId={focusId}
        locations={locations}
        onReady={(m) => (mapRef.current = m)}
      />

      {showRisk &&
        locations.map((loc) => {
          const risk = riskFor(loc);
          return (
            <Marker
              key={loc.id}
              position={[loc.latitude, loc.longitude]}
              icon={riskDivIcon(risk, loc.highPriority, selectedId === loc.id)}
              eventHandlers={{ click: () => onSelect?.(loc.id) }}
            >
              <Popup>
                <LocationPopup loc={loc} risk={risk} />
              </Popup>
            </Marker>
          );
        })}

      {showClinics &&
        clinics.map((c) => (
          <Marker
            key={c.id}
            position={[c.latitude, c.longitude]}
            icon={clinicDivIcon(c.status)}
          >
            <Popup>
              <ClinicPopup clinic={c} />
            </Popup>
          </Marker>
        ))}

      {origin && dest && (
        <>
          <Polyline
            positions={[
              [origin.latitude, origin.longitude],
              [dest.latitude, dest.longitude],
            ]}
            pathOptions={{ color: "#2dd4bf", weight: 2, dashArray: "6 8" }}
          />
          {movingPos && (
            <Marker position={movingPos} icon={movingClinicDivIcon()} />
          )}
        </>
      )}
    </MapContainer>
  );
}
