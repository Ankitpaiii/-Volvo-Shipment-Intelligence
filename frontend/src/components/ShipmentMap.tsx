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
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#22c55e";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    IN_TRANSIT: "In Transit",
    AT_RISK: "At Risk",
    DELAYED: "Delayed",
    DELIVERED: "Delivered",
    PLANNED: "Planned",
    CLOSED: "Closed",
  };
  return map[status] || status;
}

interface Props {
  shipments: Shipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function PulsingMarker({ shipment, selected, onSelect }: { shipment: Shipment; selected: boolean; onSelect: () => void }) {
  const isPulsing = shipment.status === "AT_RISK" || shipment.status === "DELAYED";
  const color = riskColor(shipment.delay_risk_score);
  const radius = selected ? 11 : 7;

  return (
    <>
      {isPulsing && (
        <Circle
          center={[shipment.current_lat!, shipment.current_lng!]}
          radius={selected ? 100000 : 60000}
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: "6 4",
          }}
        />
      )}
      <CircleMarker
        center={[shipment.current_lat!, shipment.current_lng!]}
        radius={radius}
        pathOptions={{
          color: selected ? "#38bdf8" : color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: selected ? 3 : 1.5,
        }}
        eventHandlers={{ click: onSelect }}
      >
        <Popup>
          <div className="space-y-1 min-w-[160px]">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-sm text-slate-100">{shipment.po_number}</p>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: `${color}30`, color }}
              >
                {shipment.delay_risk_score}%
              </span>
            </div>
            <p className="text-xs text-slate-400">{shipment.lane_name}</p>
            <p className="text-xs text-slate-300">
              <span className="text-slate-500">Carrier: </span>{shipment.carrier_name}
            </p>
            <p className="text-xs">
              <span
                className="status-badge"
                style={{ background: `${color}20`, color }}
              >
                {statusLabel(shipment.status)}
              </span>
            </p>
            {shipment.part_criticality !== "STANDARD" && shipment.part_criticality !== "LOW" && (
              <p className="text-xs font-semibold text-sky-300">⚡ {shipment.part_criticality}</p>
            )}
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}

export function ShipmentMap({ shipments, selectedId, onSelect }: Props) {
  const positioned = shipments.filter((s) => s.current_lat != null && s.current_lng != null);
  const selected = positioned.find((s) => s.shipment_id === selectedId);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-700/60 glass" style={{ height: 440 }}>
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] glass rounded-lg px-3 py-2 space-y-1.5 text-[10px]">
        <p className="text-slate-400 font-semibold uppercase tracking-wider mb-1">Legend</p>
        {[
          { color: "#ef4444", label: "High Risk (≥70%)" },
          { color: "#f59e0b", label: "At Risk (40–69%)" },
          { color: "#22c55e", label: "On Track (<40%)" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-slate-300">{label}</span>
          </div>
        ))}
        <div className="border-t border-slate-700 pt-1 mt-1 text-slate-400">
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
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Route lines for all positioned shipments */}
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
              pathOptions={{
                color,
                weight: isSelected ? 3 : 1.5,
                opacity: isSelected ? 0.8 : 0.3,
              }}
            />
          );
        })}

        {/* Dashed future route line for selected shipment */}
        {selected && (
          <Polyline
            positions={[
              [selected.current_lat!, selected.current_lng!],
              [selected.dest_lat ?? selected.current_lat!, selected.dest_lng ?? selected.current_lng!],
            ]}
            pathOptions={{
              color: riskColor(selected.delay_risk_score),
              weight: 2,
              opacity: 0.5,
              dashArray: "8 6",
            }}
          />
        )}

        {/* Shipment markers */}
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
