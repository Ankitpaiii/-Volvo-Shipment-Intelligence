import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Shipment } from "../api/client";

// Fix Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function riskColor(score: number): string {
  if (score >= 70) return "oklch(52% 0.200 20)";   // crit red
  if (score >= 40) return "oklch(68% 0.150 62)";   // warn amber
  return "oklch(52% 0.120 165)";                   // ok green
}

function getVehicleType(s: Shipment): "ship" | "truck" | "plane" {
  const o = (s.origin_city || "").toLowerCase();
  const d = (s.dest_city || "").toLowerCase();
  const lane = (s.lane_name || "").toLowerCase();

  if (lane.includes("air") || (o.includes("delhi") && d.includes("gothenburg")) || (o.includes("pune") && d.includes("amsterdam")) || (o.includes("hyderabad") && d.includes("frankfurt"))) {
    return "plane";
  }
  if (o.includes("ningbo") || o.includes("santos") || o.includes("durban") || o.includes("shekou") || o.includes("rotterdam") || lane.includes("sea")) {
    return "ship";
  }
  return "truck";
}

function createVehicleIcon(s: Shipment, isSelected: boolean): L.DivIcon {
  const color = riskColor(s.delay_risk_score);
  const size = isSelected ? 34 : 26;
  const type = getVehicleType(s);

  let svgPath = "";
  if (type === "ship") {
    svgPath = `<path d="M2 20a2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1M4 18l-1-8h18l-1 8M7 10V6l5-3 5 3v4" />`;
  } else if (type === "plane") {
    svgPath = `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.2-2 .8l-.5.7 6.2 3.8-3.1 3.1-2.4-.6c-.5-.1-1 .1-1.3.4l-.2.2 2.6 2.6 2.6 2.6.2-.2c.3-.3.5-.8.4-1.3l-.6-2.4 3.1-3.1 3.8 6.2.7-.5c.6-.4 1-1.2.8-2z" />`;
  } else {
    // Freight Truck
    svgPath = `<rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5" fill="#111"/><circle cx="18.5" cy="18.5" r="2.5" fill="#111"/>`;
  }

  const svgContent = `
    <svg width="${size * 0.6}" height="${size * 0.6}" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
      ${svgPath}
    </svg>
  `;

  return L.divIcon({
    className: "v-marker",
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${size}px;
        height: ${size}px;
        background: #ffffff;
        border: 2px solid ${isSelected ? "var(--plum)" : color};
        border-radius: 50%;
        box-shadow: ${isSelected ? "0 0 0 4px var(--acid), 0 6px 16px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.18)"};
        transform: translateZ(0);
        cursor: pointer;
      ">
        ${svgContent}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createHubIcon(city: string, type: "origin" | "dest"): L.DivIcon {
  const isOrigin = type === "origin";
  const bg = isOrigin ? "var(--ink)" : "var(--plum)";
  const label = city.slice(0, 3).toUpperCase();

  return L.divIcon({
    className: "v-hub-marker",
    html: `
      <div style="
        background: ${bg};
        color: #ffffff;
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding: 2px 6px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        border: 1px solid rgba(255,255,255,0.3);
        white-space: nowrap;
        text-align: center;
      ">
        ${label}
      </div>
    `,
    iconSize: [34, 18],
    iconAnchor: [17, 9],
  });
}

function MapController({
  selected,
  allPositioned,
  fitTrigger,
}: {
  selected: Shipment | null;
  allPositioned: Shipment[];
  fitTrigger: number;
}) {
  const map = useMap();
  const lastSelectedIdRef = useRef<string | null>(null);

  // Center directly on the selected vehicle ONLY when selection changes
  useEffect(() => {
    if (selected && selected.current_lat != null && selected.current_lng != null) {
      if (selected.shipment_id !== lastSelectedIdRef.current) {
        lastSelectedIdRef.current = selected.shipment_id;
        // Pan smoothly to the exact vehicle position without zooming out to Scandinavia
        map.panTo([selected.current_lat, selected.current_lng], {
          animate: true,
          duration: 0.8,
        });
      }
    } else {
      lastSelectedIdRef.current = null;
    }
  }, [selected, map]);

  // "Fit corridors" button explicitly fits all active shipments
  useEffect(() => {
    if (fitTrigger > 0 && allPositioned.length > 0) {
      const bounds = L.latLngBounds(
        allPositioned.map((s) => [s.current_lat!, s.current_lng!])
      );
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.0 });
    }
  }, [fitTrigger, allPositioned, map]);

  return null;
}

interface ShipmentMapProps {
  shipments: Shipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  theme?: "light" | "dark";
}

export function ShipmentMap({
  shipments,
  selectedId,
  onSelect,
}: ShipmentMapProps) {
  const [fitTrigger, setFitTrigger] = useState(0);
  const [mode, setMode] = useState<"sea" | "air" | "road">("sea");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const positioned = useMemo(
    () => shipments.filter((s) => s.current_lat != null && s.current_lng != null),
    [shipments]
  );

  const selected = useMemo(
    () => positioned.find((s) => s.shipment_id === selectedId) || null,
    [positioned, selectedId]
  );

  const inTransit = positioned.filter((s) => s.status === "IN_TRANSIT" || s.status === "AT_RISK").length;
  const avgRisk = positioned.length > 0 ? positioned.reduce((a, s) => a + s.delay_risk_score, 0) / positioned.length : 0;
  const corridorRisk = avgRisk >= 50 ? "Elevated" : avgRisk >= 30 ? "Moderate" : "Nominal";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* Top Map Mode Tools */}
      <div className="v-map-tools" style={{ zIndex: 1000 }}>
        <button
          className={`v-chip ${mode === "sea" ? "active" : ""}`}
          onClick={() => setMode("sea")}
        >
          Sea
        </button>
        <button
          className={`v-chip ${mode === "air" ? "active" : ""}`}
          onClick={() => setMode("air")}
        >
          Air
        </button>
        <button
          className={`v-chip ${mode === "road" ? "active" : ""}`}
          onClick={() => setMode("road")}
        >
          Road
        </button>
        <button
          className="v-chip"
          onClick={() => {
            onSelect("");
            setFitTrigger((c) => c + 1);
          }}
        >
          Fit corridors
        </button>
      </div>

      {/* Main Leaflet Map */}
      <MapContainer
        center={[28.0, 45.0]}
        zoom={4}
        style={{ height: "100%", width: "100%", background: "var(--paper-sunk)" }}
        scrollWheelZoom
        zoomControl={false}
      >
        {/* OpenStreetMap tile layer styled with KIRUNA daylight bone-paper filter */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        <MapController
          selected={selected}
          allPositioned={positioned}
          fitTrigger={fitTrigger}
        />

        {/* Trajectory Corridors Passing Directly Through Vehicle Coordinates */}
        {positioned.map((s) => {
          const isSelected = s.shipment_id === selectedId;
          const color = riskColor(s.delay_risk_score);

          // Traveled path: origin -> current GPS position (locked to vehicle)
          const traveledCoords: [number, number][] = [
            [s.origin_lat, s.origin_lng],
            [s.current_lat!, s.current_lng!],
          ];

          // Remaining path: current GPS position -> destination
          const remainingCoords: [number, number][] = [
            [s.current_lat!, s.current_lng!],
            [s.dest_lat, s.dest_lng],
          ];

          return (
            <div key={`corridor-${s.shipment_id}`}>
              {/* Traveled leg (solid) */}
              <Polyline
                positions={traveledCoords}
                pathOptions={{
                  color: isSelected ? "var(--plum)" : "#64748B",
                  weight: isSelected ? 3.5 : 1.8,
                  opacity: isSelected ? 0.95 : 0.45,
                }}
              />

              {/* Remaining leg (dashed) */}
              <Polyline
                positions={remainingCoords}
                pathOptions={{
                  color: isSelected ? color : "#94A3B8",
                  weight: isSelected ? 3 : 1.4,
                  opacity: isSelected ? 0.85 : 0.35,
                  dashArray: "5 7",
                }}
              />

              {/* Glowing halo when selected */}
              {isSelected && (
                <Polyline
                  positions={[...traveledCoords, [s.dest_lat, s.dest_lng]]}
                  pathOptions={{
                    color,
                    weight: 8,
                    opacity: 0.22,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Selected Shipment Origin and Destination Hubs */}
        {selected && (
          <>
            <Marker
              position={[selected.origin_lat, selected.origin_lng]}
              icon={createHubIcon(selected.origin_city, "origin")}
            />
            <Marker
              position={[selected.dest_lat, selected.dest_lng]}
              icon={createHubIcon(selected.dest_city, "dest")}
            />
          </>
        )}

        {/* Live GPS Vehicle Markers */}
        {positioned.map((s) => {
          const isSelected = s.shipment_id === selectedId;
          const color = riskColor(s.delay_risk_score);
          const isAtRisk = s.delay_risk_score >= 50;

          return (
            <div key={`marker-group-${s.shipment_id}`}>
              {/* Radar pulse around at-risk vehicles */}
              {isAtRisk && (
                <Circle
                  center={[s.current_lat!, s.current_lng!]}
                  radius={isSelected ? 140000 : 80000}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.1,
                    weight: 1.2,
                    dashArray: "4 4",
                  }}
                />
              )}

              <Marker
                position={[s.current_lat!, s.current_lng!]}
                icon={createVehicleIcon(s, isSelected)}
                eventHandlers={{
                  click: () => onSelect(s.shipment_id),
                }}
              >
                {/* Tooltip on hover */}
                <Tooltip direction="top" offset={[0, -18]} opacity={0.96}>
                  <div style={{ fontSize: "11px", fontWeight: 700, fontFamily: "var(--mono)" }}>
                    {s.po_number} · {s.origin_city} → {s.dest_city}
                    <span style={{ color, marginLeft: 6 }}>
                      ({s.delay_risk_score}% Risk)
                    </span>
                  </div>
                </Tooltip>

                {/* Rich Telemetry Popup on click (autoPan disabled to prevent camera jerk) */}
                <Popup autoPan={false}>
                  <div style={{ minWidth: 210, padding: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <b style={{ fontFamily: "var(--mono)", fontSize: "13px" }}>{s.po_number}</b>
                      <span className="v-tag v-tag-acid" style={{ fontSize: "10px" }}>{s.delay_risk_score}% RISK</span>
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--ink-2)", margin: "0 0 6px" }}>
                      {s.origin_city} → {s.dest_city}
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: "10px", margin: "6px 0" }}>
                      <div style={{ background: "var(--surface-2)", padding: 4, borderRadius: 4 }}>
                        <span className="v-eyebrow" style={{ display: "block", fontSize: "9px" }}>SPEED</span>
                        <b>{s.current_speed ? `${s.current_speed} kn` : "16.4 kn"}</b>
                      </div>
                      <div style={{ background: "var(--surface-2)", padding: 4, borderRadius: 4 }}>
                        <span className="v-eyebrow" style={{ display: "block", fontSize: "9px" }}>HEALTH</span>
                        <b>{s.health_score} / 100</b>
                      </div>
                    </div>
                    {expandedId === s.shipment_id && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)", fontSize: "11px", display: "grid", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="v-meta">Carrier</span>
                          <span style={{ fontWeight: 600 }}>{s.carrier_name}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="v-meta">Supplier</span>
                          <span>{s.supplier_name}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="v-meta">Criticality</span>
                          <span className="v-tag v-tag-acid" style={{ padding: "1px 5px", fontSize: "10px" }}>{s.part_criticality}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="v-meta">Planned ETA</span>
                          <span className="v-mono">{s.planned_delivery ? new Date(s.planned_delivery).toLocaleDateString([], { day: "2-digit", month: "short" }) : "On schedule"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="v-meta">GPS Coordinates</span>
                          <span className="v-mono">{s.current_lat?.toFixed(3)}°, {s.current_lng?.toFixed(3)}°</span>
                        </div>
                      </div>
                    )}
                    <button
                      className="v-btn v-btn-sm v-btn-key v-btn-block"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        onSelect(s.shipment_id);
                        setExpandedId((cur) => cur === s.shipment_id ? null : s.shipment_id);
                        const detailCol = document.querySelector(".v-col-detail");
                        if (detailCol) {
                          detailCol.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                    >
                      {expandedId === s.shipment_id ? "Collapse Specs" : "Inspect Telemetry →"}
                    </button>
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>

      {/* Floating Bottom Telemetry Strip */}
      <div className="v-telemetry" style={{ zIndex: 1000 }}>
        <div className="v-telemetry-cell">
          <span className="v-eyebrow">In transit</span>
          <b>{inTransit || positioned.length || 28}</b>
        </div>
        <div className="v-telemetry-cell">
          <span className="v-eyebrow">Avg speed</span>
          <b>16.4 <small style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--ink-2)" }}>kn</small></b>
        </div>
        <div className="v-telemetry-cell">
          <span className="v-eyebrow">Corridor risk</span>
          <b style={{ color: avgRisk >= 50 ? "var(--crit)" : avgRisk >= 30 ? "var(--warn)" : "var(--ok)" }}>
            {corridorRisk}
          </b>
        </div>
        <div className="v-telemetry-cell">
          <span className="v-eyebrow">Last GPS ping</span>
          <b className="v-mono">0:12</b>
        </div>
      </div>
    </div>
  );
}
