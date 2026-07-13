import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Circle,
} from "react-leaflet";
import type { Shipment } from "../api/client";

function riskColor(score: number): string {
  if (score >= 70) return "#E5564A";   // signal-red dark / #C7362B light
  if (score >= 40) return "#E0A23D";   // signal-amber
  return "#3ECF8E";                    // signal-green
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    IN_TRANSIT: "In Transit",
    AT_RISK:    "At Risk",
    DELAYED:    "Delayed",
    DELIVERED:  "Delivered",
    PLANNED:    "Planned",
    CLOSED:     "Closed",
  };
  return map[status] || status;
}

interface Props {
  shipments: Shipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  theme?: "light" | "dark";
}

function PulsingMarker({ shipment, selected, onSelect }: { shipment: Shipment; selected: boolean; onSelect: () => void }) {
  const isPulsing = shipment.status === "AT_RISK" || shipment.status === "DELAYED";
  const color     = riskColor(shipment.delay_risk_score);
  const radius    = selected ? 11 : 7;

  return (
    <>
      {isPulsing && (
        <Circle
          center={[shipment.current_lat!, shipment.current_lng!]}
          radius={selected ? 100000 : 60000}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.07, weight: 1.5, dashArray: "6 4" }}
        />
      )}
      <CircleMarker
        center={[shipment.current_lat!, shipment.current_lng!]}
        radius={radius}
        pathOptions={{
          color: selected ? "#F4F5F7" : color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: selected ? 3 : 1.5,
        }}
        eventHandlers={{ click: onSelect }}
      >
        <Popup>
          <div style={{ minWidth: 160, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--platinum-100)" }}>
                {shipment.po_number}
              </span>
              <span style={{
                fontSize: "0.65rem", fontWeight: 700, padding: "2px 6px",
                borderRadius: 9999, border: `1px solid ${color}`, color,
              }}>
                {shipment.delay_risk_score}%
              </span>
            </div>
            <span style={{ fontSize: "0.68rem", color: "var(--silver-500)" }}>{shipment.lane_name}</span>
            <span style={{ fontSize: "0.68rem", color: "var(--silver-700)" }}>
              <span style={{ color: "var(--silver-500)" }}>Carrier: </span>
              {shipment.carrier_name}
            </span>
            <span style={{
              fontSize: "0.6rem", fontWeight: 700, padding: "2px 7px", borderRadius: 9999,
              border: `1px solid ${color}`, color, display: "inline-block", alignSelf: "flex-start",
            }}>
              {statusLabel(shipment.status)}
            </span>
            {shipment.part_criticality !== "STANDARD" && shipment.part_criticality !== "LOW" && (
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--signal-amber)" }}>
                {shipment.part_criticality}
              </span>
            )}
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}

export function ShipmentMap({ shipments, selectedId, onSelect, theme = "dark" }: Props) {
  const positioned = shipments.filter((s) => s.current_lat != null && s.current_lng != null);
  const selected   = positioned.find((s) => s.shipment_id === selectedId);

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 10, height: "100%", width: "100%" }}>
      {/* Map Legend */}
      <div style={{
        position: "absolute", bottom: 16, left: 16, zIndex: 1000,
        backgroundColor: "var(--bg-panel-raised)",
        border: "1px solid var(--graphite-line)",
        borderRadius: 8, padding: "8px 12px",
        display: "flex", flexDirection: "column", gap: 5,
      }}>
        <span style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--silver-500)", marginBottom: 2 }}>
          Legend
        </span>
        {[
          { color: "#E5564A", label: "High Risk (≥70%)" },
          { color: "#E0A23D", label: "At Risk (40–69%)" },
          { color: "#3ECF8E", label: "On Track (<40%)" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.65rem", color: "var(--silver-700)" }}>{label}</span>
          </div>
        ))}
        <div style={{ borderTop: "1px solid var(--graphite-line)", paddingTop: 5, marginTop: 2, fontSize: "0.62rem", color: "var(--silver-500)" }}>
          {positioned.length} shipments tracked
        </div>
      </div>

      <MapContainer
        center={[30, 40]}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={
            theme === "light"
              ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          }
        />

        {/* Route lines */}
        {positioned.map((s) => {
          const isSelected = s.shipment_id === selectedId;
          const color = riskColor(s.delay_risk_score);
          return (
            <Polyline
              key={`route-${s.shipment_id}`}
              positions={[
                [s.origin_lat ?? s.current_lat!, s.origin_lng ?? s.current_lng!],
                [s.current_lat!, s.current_lng!],
              ]}
              pathOptions={{ color, weight: isSelected ? 3 : 1.5, opacity: isSelected ? 0.8 : 0.3 }}
            />
          );
        })}

        {/* Future dashed route for selected */}
        {selected && (
          <Polyline
            positions={[
              [selected.current_lat!, selected.current_lng!],
              [selected.dest_lat ?? selected.current_lat!, selected.dest_lng ?? selected.current_lng!],
            ]}
            pathOptions={{ color: riskColor(selected.delay_risk_score), weight: 2, opacity: 0.45, dashArray: "8 6" }}
          />
        )}

        {/* Markers */}
        {positioned.map((s) => (
          <PulsingMarker
            key={s.shipment_id}
            shipment={s}
            selected={s.shipment_id === selectedId}
            onSelect={() => onSelect(s.shipment_id)}
          />
        ))}
      </MapContainer>
    </div>
  );
}
